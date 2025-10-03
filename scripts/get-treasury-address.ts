/**
 * Simple script to get the treasury smart account address
 * Run with: npx tsx scripts/get-treasury-address.ts
 */

import "dotenv/config";
import { getTreasurySmartAccount } from "../lib/treasury-service";

async function main() {
  console.log("Fetching treasury smart account address...\n");

  const address = await getTreasurySmartAccount();

  console.log("=".repeat(50));
  console.log("Treasury Smart Account Address:");
  console.log(address);
  console.log("=".repeat(50));
  console.log("\nSend USDC to this address to fund welcome bonuses!");
  console.log("This is a SMART ACCOUNT (not an EOA)");
  console.log("Transactions from this account are gasless via Alchemy policy.");
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
