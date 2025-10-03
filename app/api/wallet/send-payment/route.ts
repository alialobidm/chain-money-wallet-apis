import { createClient } from "@/lib/supabase/server";
import {
  prepareCalls,
  sendPreparedCalls,
  signMessageHash,
  getCallsStatus,
} from "@/lib/wallet-service";
import { db } from "@/src/db";
import { profilesTable, transactionsTable } from "@/src/db/schema";
import { eq } from "drizzle-orm";
import {
  type Address,
  type Hex,
  encodeFunctionData,
  parseUnits,
  toHex,
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
import { AAVE_POOL_ABI, ERC20_ABI, ATOKEN_ABI } from "@/lib/aave-abis";

const tokenABI = [
  {
    name: "transfer",
    type: "function",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
  },
] as const;

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { recipientUserId, amount, message, chainId } = body;

    if (!recipientUserId || !amount) {
      return Response.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Get sender's profile with smart account
    const senderProfile = await db
      .select()
      .from(profilesTable)
      .where(eq(profilesTable.userId, user.id))
      .limit(1);

    if (senderProfile.length === 0 || !senderProfile[0].smartAccountAddress) {
      return Response.json(
        { error: "Sender wallet not initialized" },
        { status: 400 }
      );
    }

    // Get recipient's profile
    const recipientProfile = await db
      .select()
      .from(profilesTable)
      .where(eq(profilesTable.userId, recipientUserId))
      .limit(1);

    if (
      recipientProfile.length === 0 ||
      !recipientProfile[0].smartAccountAddress
    ) {
      return Response.json(
        { error: "Recipient wallet not initialized" },
        { status: 400 }
      );
    }

    const fromAddress = senderProfile[0].smartAccountAddress as Address;
    const toAddress = recipientProfile[0].smartAccountAddress as Address;
    const recipientWantsYield = recipientProfile[0].isEarningYield;

    // Convert amount to token units (6 decimals for USDC)
    const requestedAmount = parseUnits(amount, 6);

    console.log(`Sending ${amount} to ${recipientProfile[0].username}`);
    console.log(`Recipient wants yield: ${recipientWantsYield}`);

    // Create viem public client for reading blockchain data
    const publicClient = createPublicClient({
      chain: baseSepolia,
      transport: http(),
    });

    // Step 1: Check sender's balances (both USDC and aUSDC)
    const senderUsdcBalance = (await publicClient.readContract({
      address: USDC_CONTRACT_ADDRESS as Address,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [fromAddress],
    })) as bigint;

    const senderAusdcBalance = (await publicClient.readContract({
      address: AUSDC_CONTRACT_ADDRESS as Address,
      abi: ATOKEN_ABI,
      functionName: "balanceOf",
      args: [fromAddress],
    })) as bigint;

    const totalBalance = senderUsdcBalance + senderAusdcBalance;

    console.log(`Sender USDC: ${formatUnits(senderUsdcBalance, 6)}`);
    console.log(`Sender aUSDC: ${formatUnits(senderAusdcBalance, 6)}`);
    console.log(`Total: ${formatUnits(totalBalance, 6)}`);

    // Check if sender has enough total balance
    if (totalBalance < requestedAmount) {
      return Response.json(
        {
          error: `Insufficient balance. You have ${formatUnits(totalBalance, 6)} USDC total, but need ${amount}`,
        },
        { status: 400 }
      );
    }

    // Step 2: Build the transaction calls array
    const calls: Array<{ to: Address; data: Hex; value?: Hex }> = [];

    // Determine which token to send based on recipient preference
    const tokenToSend = recipientWantsYield ? AUSDC_CONTRACT_ADDRESS : USDC_CONTRACT_ADDRESS;
    const tokenToSendBalance = recipientWantsYield ? senderAusdcBalance : senderUsdcBalance;

    console.log(`Need to send: ${recipientWantsYield ? 'aUSDC' : 'USDC'}`);
    console.log(`Current balance of that token: ${formatUnits(tokenToSendBalance, 6)}`);

    // Step 3: If we don't have enough of the token recipient wants, convert first
    if (tokenToSendBalance < requestedAmount) {
      const amountToConvert = requestedAmount - tokenToSendBalance;
      console.log(`Need to convert ${formatUnits(amountToConvert, 6)} first`);

      if (recipientWantsYield) {
        // Need more aUSDC: supply USDC to AAVE
        // Check if we need approval
        const currentAllowance = (await publicClient.readContract({
          address: USDC_CONTRACT_ADDRESS as Address,
          abi: ERC20_ABI,
          functionName: "allowance",
          args: [fromAddress, AAVE_V3_POOL_ADDRESS as Address],
        })) as bigint;

        if (currentAllowance < amountToConvert) {
          const approvalData = encodeFunctionData({
            abi: ERC20_ABI,
            functionName: "approve",
            args: [AAVE_V3_POOL_ADDRESS as Address, amountToConvert],
          });
          calls.push({
            to: USDC_CONTRACT_ADDRESS as Address,
            data: approvalData,
          });
        }

        // Supply to AAVE
        const supplyData = encodeFunctionData({
          abi: AAVE_POOL_ABI,
          functionName: "supply",
          args: [USDC_CONTRACT_ADDRESS as Address, amountToConvert, fromAddress, 0],
        });
        calls.push({
          to: AAVE_V3_POOL_ADDRESS as Address,
          data: supplyData,
          value: toHex(0n),
        });
      } else {
        // Need more USDC: withdraw from AAVE
        const withdrawData = encodeFunctionData({
          abi: AAVE_POOL_ABI,
          functionName: "withdraw",
          args: [USDC_CONTRACT_ADDRESS as Address, amountToConvert, fromAddress],
        });
        calls.push({
          to: AAVE_V3_POOL_ADDRESS as Address,
          data: withdrawData,
          value: toHex(0n),
        });
      }
    }

    // Step 4: Add the transfer call
    const transferData = encodeFunctionData({
      abi: tokenABI,
      functionName: "transfer",
      args: [toAddress, requestedAmount],
    });
    calls.push({
      to: tokenToSend as Address,
      data: transferData,
    });

    console.log(`Preparing ${calls.length} calls for payment transaction`);

    // Step 5: Prepare and send all calls in a single batch
    const prepared = await prepareCalls({
      from: fromAddress,
      calls,
      chainId: chainId || CHAIN_ID,
    });

    const signature = await signMessageHash(prepared.signatureRequest.data.raw);
    const result = await sendPreparedCalls({
      preparedCalls: prepared,
      signature,
    });

    console.log("Send prepared calls result:", result);

    if (!result.callsId) {
      console.error("No callsId returned from sendPreparedCalls");
      return Response.json(
        { error: "Failed to submit transaction - no callsId returned" },
        { status: 500 }
      );
    }

    // Poll for transaction hash
    let transactionHash: string | undefined;
    let attempts = 0;
    const maxAttempts = 15;

    while (attempts < maxAttempts) {
      try {
        const status = await getCallsStatus(result.callsId);

        console.log(`Poll attempt ${attempts + 1}: status=${status.status}, receipts=${status.receipts?.length || 0}`);

        if (status.receipts && status.receipts.length > 0) {
          // Get the last receipt which should be the transfer transaction
          transactionHash = status.receipts[status.receipts.length - 1].transactionHash;
          console.log(`Found transaction hash: ${transactionHash}`);
          break;
        }

        if (status.status === "CONFIRMED") {
          console.log("Transaction confirmed but no receipts yet");
          break;
        }

        // Wait 1 second before next attempt
        await new Promise((resolve) => setTimeout(resolve, 1000));
        attempts++;
      } catch (error) {
        console.error("Error getting call status:", error);
        break;
      }
    }

    // Always store the transaction in database (even without txHash for now)
    // The txHash will help with linking to explorer
    try {
      await db.insert(transactionsTable).values({
        transactionHash: transactionHash || `pending-${result.callsId}`,
        fromUserId: user.id,
        toUserId: recipientUserId,
        amount: amount,
        message: message || null,
      });
      console.log(`Transaction saved to database: ${transactionHash || 'pending'}`);
    } catch (dbError) {
      console.error("Error storing transaction:", dbError);
      // Don't fail the request if DB insert fails
    }

    return Response.json({
      success: true,
      callsId: result.callsId,
      transactionHash,
    });
  } catch (error) {
    console.error("Error sending payment:", error);
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to send payment",
      },
      { status: 500 }
    );
  }
}
