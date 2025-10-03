import { createClient } from "@/lib/supabase/server";
import { db } from "@/src/db";
import { profilesTable } from "@/src/db/schema";
import { eq } from "drizzle-orm";
import {
  prepareCalls,
  sendPreparedCalls,
  signMessageHash,
  getCallsStatus,
} from "@/lib/wallet-service";
import {
  type Address,
  type Hex,
  toHex,
  encodeFunctionData,
  createPublicClient,
  http,
  formatUnits,
} from "viem";
import { baseSepolia } from "viem/chains";
import {
  USDC_CONTRACT_ADDRESS,
  AUSDC_CONTRACT_ADDRESS,
  AAVE_V3_POOL_ADDRESS,
  CHAIN_ID,
} from "@/lib/constants";
import { AAVE_POOL_ABI, ATOKEN_ABI } from "@/lib/aave-abis";

export async function POST() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's profile with smart account
    const userProfile = await db
      .select()
      .from(profilesTable)
      .where(eq(profilesTable.userId, user.id))
      .limit(1);

    if (userProfile.length === 0 || !userProfile[0].smartAccountAddress) {
      return Response.json(
        { error: "Wallet not initialized" },
        { status: 400 }
      );
    }

    const smartAccountAddress = userProfile[0]
      .smartAccountAddress as Address;

    // Update user's isEarningYield preference in database first
    await db
      .update(profilesTable)
      .set({ isEarningYield: false })
      .where(eq(profilesTable.userId, user.id));

    // Create viem public client for reading blockchain data
    const publicClient = createPublicClient({
      chain: baseSepolia,
      transport: http(),
    });

    // Step 1: Check aToken balance (amount supplied to AAVE)
    const aTokenBalance = (await publicClient.readContract({
      address: AUSDC_CONTRACT_ADDRESS as Address,
      abi: ATOKEN_ABI,
      functionName: "balanceOf",
      args: [smartAccountAddress],
    })) as bigint;

    if (aTokenBalance === 0n) {
      console.log("No aUSDC balance to withdraw, but preference saved");
      return Response.json({
        success: true,
        message: "Earning disabled. Funds will be moved out of AAVE when received.",
      });
    }

    const withdrawAmount = formatUnits(aTokenBalance, 6);
    console.log(
      `Withdrawing ${withdrawAmount} USDC (${aTokenBalance} units) from AAVE...`
    );

    // Step 2: Build withdraw transaction
    // Use type(uint256).max to withdraw all
    const withdrawData = encodeFunctionData({
      abi: AAVE_POOL_ABI,
      functionName: "withdraw",
      args: [
        USDC_CONTRACT_ADDRESS as Address, // asset
        aTokenBalance, // amount (withdraw all)
        smartAccountAddress, // to
      ],
    });

    const calls: Array<{
      to: Address;
      data: Hex;
      value?: Hex;
    }> = [
      {
        to: AAVE_V3_POOL_ADDRESS as Address,
        data: withdrawData,
        value: toHex(0n),
      },
    ];

    console.log(`Preparing ${calls.length} calls for withdraw transaction`);

    // Step 3: Prepare and send the transaction
    const prepared = await prepareCalls({
      from: smartAccountAddress,
      calls: calls.map((call) => ({
        to: call.to,
        data: call.data,
        value: call.value,
      })),
      chainId: CHAIN_ID,
    });

    // Sign with master account
    const signature = await signMessageHash(prepared.signatureRequest.data.raw);

    // Send the transaction (fire and forget - don't wait for confirmation)
    sendPreparedCalls({
      preparedCalls: prepared,
      signature,
    }).then((result) => {
      console.log(`Withdraw transaction submitted with callsId: ${result.callsId}`);
      // Optionally poll for confirmation in background
      getCallsStatus(result.callsId).then((status) => {
        if (status.receipts && status.receipts.length > 0) {
          console.log(`Transaction confirmed: ${status.receipts[0].transactionHash}`);
        }
      });
    }).catch((error) => {
      console.error("Error sending withdraw transaction:", error);
    });

    // Return success immediately for fast UX
    return Response.json({
      success: true,
      withdrawnAmount: withdrawAmount,
    });
  } catch (error) {
    console.error("Error withdrawing from AAVE:", error);
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to withdraw from AAVE",
      },
      { status: 500 }
    );
  }
}
