/**
 * Send welcome bonuses to existing users who already have smart accounts
 * Run with: npx tsx scripts/send-retroactive-bonuses.ts
 */

import "dotenv/config";
import { db } from "../src/db";
import { profilesTable } from "../src/db/schema";
import { eq, and, isNotNull } from "drizzle-orm";
import { sendWelcomeBonus } from "../lib/treasury-service";

async function main() {
  console.log("Finding users who need retroactive welcome bonuses...\n");

  // Find users who have smart accounts but haven't received welcome bonus
  const eligibleUsers = await db
    .select()
    .from(profilesTable)
    .where(
      and(
        isNotNull(profilesTable.smartAccountAddress),
        eq(profilesTable.receivedWelcomeBonus, false)
      )
    );

  console.log(`Found ${eligibleUsers.length} eligible users\n`);

  if (eligibleUsers.length === 0) {
    console.log("No users need bonuses. Exiting.");
    return;
  }

  for (const user of eligibleUsers) {
    try {
      console.log(`Sending bonus to ${user.username} (${user.smartAccountAddress})...`);

      const result = await sendWelcomeBonus(user.smartAccountAddress!);

      // Mark as received
      await db
        .update(profilesTable)
        .set({ receivedWelcomeBonus: true })
        .where(eq(profilesTable.userId, user.userId));

      console.log(`✓ Sent! CallsId: ${result.callsId}\n`);
    } catch (error) {
      console.error(`✗ Failed for ${user.username}:`, error);
      console.log();
    }
  }

  console.log("Done!");
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
