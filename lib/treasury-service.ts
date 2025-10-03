/**
 * Treasury Service
 *
 * Handles sending welcome bonuses to new users from the treasury smart account
 * Uses the same wallet-service functions to send gasless transactions
 */

import { encodeFunctionData, parseUnits } from "viem";
import { sendPayment } from "./wallet-service";
import { USDC_CONTRACT_ADDRESS, CHAIN_ID } from "./constants";

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

/**
 * Get the treasury smart account address
 * Uses the existing default smart account (created without salt) as the treasury
 * This is the account at 0xa5f67272d2F0124563c36415BA25619f85607892
 */
export async function getTreasurySmartAccount(): Promise<string> {
  // The treasury uses the default smart account (no salt) for the master signer
  // This was already created, so just return its address
  return "0xa5f67272d2F0124563c36415BA25619f85607892";
}

/**
 * Send welcome bonus to a new user
 * Sends $1 USDC from the treasury smart account (gasless via policy)
 */
export async function sendWelcomeBonus(
  recipientSmartAccountAddress: string
): Promise<{ callsId: string; transactionHash?: string }> {
  // Get treasury smart account address
  const treasuryAddress = await getTreasurySmartAccount();

  // Amount: $1 USDC (6 decimals)
  const amount = parseUnits("1", 6);

  // Encode the transfer call
  const callData = encodeFunctionData({
    abi: tokenABI,
    functionName: "transfer",
    args: [recipientSmartAccountAddress as `0x${string}`, amount],
  });

  // Send payment from treasury using the same gasless flow as user payments
  const result = await sendPayment({
    fromSmartAccount: treasuryAddress,
    toAddress: USDC_CONTRACT_ADDRESS,
    tokenAmount: amount.toString(),
    callData,
    chainId: CHAIN_ID,
  });

  return result;
}
