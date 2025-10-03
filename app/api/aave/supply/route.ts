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
} from "viem";
import { baseSepolia } from "viem/chains";
import {
  USDC_CONTRACT_ADDRESS,
  AAVE_V3_POOL_ADDRESS,
  CHAIN_ID,
} from "@/lib/constants";
import { AAVE_POOL_ABI, ERC20_ABI } from "@/lib/aave-abis";

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

    // Create viem public client for reading blockchain data
    const publicClient = createPublicClient({
      chain: baseSepolia,
      transport: http(),
    });

    // Update user's isEarningYield preference in database first
    await db
      .update(profilesTable)
      .set({ isEarningYield: true })
      .where(eq(profilesTable.userId, user.id));

    // Step 1: Get current USDC balance (liquid balance to move to AAVE)
    const usdcBalance = (await publicClient.readContract({
      address: USDC_CONTRACT_ADDRESS as Address,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [smartAccountAddress],
    })) as bigint;

    if (usdcBalance === 0n) {
      console.log("No USDC balance to supply, but preference saved");
      return Response.json({
        success: true,
        message: "Earning enabled. Funds will be moved to AAVE when received.",
      });
    }

    console.log(
      `Supplying ${usdcBalance} USDC units to AAVE on Base Sepolia...`
    );

    // Step 2: Check current allowance
    const currentAllowance = (await publicClient.readContract({
      address: USDC_CONTRACT_ADDRESS as Address,
      abi: ERC20_ABI,
      functionName: "allowance",
      args: [smartAccountAddress, AAVE_V3_POOL_ADDRESS as Address],
    })) as bigint;

    console.log(`Current allowance: ${currentAllowance}`);

    // Step 3: Build calls array (approval + supply if needed, or just supply)
    const calls: Array<{
      to: Address;
      data: Hex;
      value?: Hex;
    }> = [];

    // If allowance is insufficient, add approval call
    if (currentAllowance < usdcBalance) {
      console.log("Approval needed, adding approval call");
      const approvalData = encodeFunctionData({
        abi: ERC20_ABI,
        functionName: "approve",
        args: [AAVE_V3_POOL_ADDRESS as Address, usdcBalance],
      });

      calls.push({
        to: USDC_CONTRACT_ADDRESS as Address,
        data: approvalData,
      });
    }

    // Add supply call
    const supplyData = encodeFunctionData({
      abi: AAVE_POOL_ABI,
      functionName: "supply",
      args: [
        USDC_CONTRACT_ADDRESS as Address, // asset
        usdcBalance, // amount (all USDC)
        smartAccountAddress, // onBehalfOf
        0, // referralCode
      ],
    });

    calls.push({
      to: AAVE_V3_POOL_ADDRESS as Address,
      data: supplyData,
      value: toHex(0n),
    });

    console.log(`Preparing ${calls.length} calls for supply transaction`);

    // Step 4: Prepare and send using wallet service
    // Send all calls in a single batch transaction
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
      console.log(`Supply transaction submitted with callsId: ${result.callsId}`);
      // Optionally poll for confirmation in background
      getCallsStatus(result.callsId).then((status) => {
        if (status.receipts && status.receipts.length > 0) {
          console.log(`Transaction confirmed: ${status.receipts[0].transactionHash}`);
        }
      });
    }).catch((error) => {
      console.error("Error sending supply transaction:", error);
    });

    // Return success immediately for fast UX
    return Response.json({
      success: true,
    });
  } catch (error) {
    console.error("Error supplying to AAVE:", error);
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to supply to AAVE",
      },
      { status: 500 }
    );
  }
}
