/**
 * Background sweep script to rebalance user funds based on their earning preference
 *
 * For each user:
 * - If isEarningYield = true: Move any USDC -> aUSDC (supply to AAVE)
 * - If isEarningYield = false: Move any aUSDC -> USDC (withdraw from AAVE)
 *
 * Run this periodically via cron job or Vercel scheduled function
 */

import { db } from "@/src/db";
import { profilesTable } from "@/src/db/schema";
import {
  prepareCalls,
  sendPreparedCalls,
  signMessageHash,
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
import { AAVE_POOL_ABI, ERC20_ABI, ATOKEN_ABI } from "@/lib/aave-abis";

const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(),
});

async function rebalanceUser(
  smartAccountAddress: Address,
  isEarningYield: boolean,
  username: string
) {
  console.log(`\n--- Rebalancing user: ${username} (${smartAccountAddress}) ---`);
  console.log(`Earning preference: ${isEarningYield}`);

  try {
    // Fetch both balances
    const usdcBalance = (await publicClient.readContract({
      address: USDC_CONTRACT_ADDRESS as Address,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [smartAccountAddress],
    })) as bigint;

    const ausdcBalance = (await publicClient.readContract({
      address: AUSDC_CONTRACT_ADDRESS as Address,
      abi: ATOKEN_ABI,
      functionName: "balanceOf",
      args: [smartAccountAddress],
    })) as bigint;

    console.log(`USDC balance: ${formatUnits(usdcBalance, 6)}`);
    console.log(`aUSDC balance: ${formatUnits(ausdcBalance, 6)}`);

    if (isEarningYield) {
      // User wants to earn yield: move any USDC -> aUSDC
      if (usdcBalance === 0n) {
        console.log("✓ No USDC to move to AAVE");
        return;
      }

      console.log(`Moving ${formatUnits(usdcBalance, 6)} USDC to AAVE...`);

      // Check allowance
      const currentAllowance = (await publicClient.readContract({
        address: USDC_CONTRACT_ADDRESS as Address,
        abi: ERC20_ABI,
        functionName: "allowance",
        args: [smartAccountAddress, AAVE_V3_POOL_ADDRESS as Address],
      })) as bigint;

      const calls: Array<{ to: Address; data: Hex; value?: Hex }> = [];

      // Add approval if needed
      if (currentAllowance < usdcBalance) {
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
          USDC_CONTRACT_ADDRESS as Address,
          usdcBalance,
          smartAccountAddress,
          0,
        ],
      });
      calls.push({
        to: AAVE_V3_POOL_ADDRESS as Address,
        data: supplyData,
        value: toHex(0n),
      });

      // Execute transaction
      const prepared = await prepareCalls({
        from: smartAccountAddress,
        calls,
        chainId: CHAIN_ID,
      });

      const signature = await signMessageHash(prepared.signatureRequest.data.raw);
      const result = await sendPreparedCalls({
        preparedCalls: prepared,
        signature,
      });

      console.log(`✓ Supply transaction submitted: ${result.callsId}`);
    } else {
      // User doesn't want to earn yield: move any aUSDC -> USDC
      if (ausdcBalance === 0n) {
        console.log("✓ No aUSDC to withdraw from AAVE");
        return;
      }

      console.log(`Withdrawing ${formatUnits(ausdcBalance, 6)} aUSDC from AAVE...`);

      // Build withdraw call
      const withdrawData = encodeFunctionData({
        abi: AAVE_POOL_ABI,
        functionName: "withdraw",
        args: [
          USDC_CONTRACT_ADDRESS as Address,
          ausdcBalance,
          smartAccountAddress,
        ],
      });

      const calls = [
        {
          to: AAVE_V3_POOL_ADDRESS as Address,
          data: withdrawData,
          value: toHex(0n),
        },
      ];

      // Execute transaction
      const prepared = await prepareCalls({
        from: smartAccountAddress,
        calls,
        chainId: CHAIN_ID,
      });

      const signature = await signMessageHash(prepared.signatureRequest.data.raw);
      const result = await sendPreparedCalls({
        preparedCalls: prepared,
        signature,
      });

      console.log(`✓ Withdraw transaction submitted: ${result.callsId}`);
    }
  } catch (error) {
    console.error(`✗ Error rebalancing user ${username}:`, error);
  }
}

async function main() {
  console.log("Starting user rebalancing sweep...");
  console.log(`Timestamp: ${new Date().toISOString()}`);

  try {
    // Get all users with smart accounts
    const users = await db
      .select({
        smartAccountAddress: profilesTable.smartAccountAddress,
        isEarningYield: profilesTable.isEarningYield,
        username: profilesTable.username,
      })
      .from(profilesTable)
      .where((table) => table.smartAccountAddress !== null);

    console.log(`Found ${users.length} users with smart accounts\n`);

    // Process each user
    for (const user of users) {
      if (!user.smartAccountAddress) continue;

      await rebalanceUser(
        user.smartAccountAddress as Address,
        user.isEarningYield,
        user.username
      );

      // Add a small delay between users to avoid rate limits
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    console.log("\n✓ Rebalancing sweep complete!");
  } catch (error) {
    console.error("✗ Fatal error during sweep:", error);
    process.exit(1);
  }
}

// Run the script
main();
