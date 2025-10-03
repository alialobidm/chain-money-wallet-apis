import { createClient } from "@/lib/supabase/server";
import { sendWelcomeBonus } from "@/lib/treasury-service";
import { db } from "@/src/db";
import { profilesTable } from "@/src/db/schema";
import { eq } from "drizzle-orm";

/**
 * Send $1 welcome bonus to a user's smart account
 * This is called after wallet initialization
 */
export async function POST() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's profile
    const profile = await db
      .select()
      .from(profilesTable)
      .where(eq(profilesTable.userId, user.id))
      .limit(1);

    if (profile.length === 0 || !profile[0].smartAccountAddress) {
      return Response.json(
        { error: "Wallet not initialized" },
        { status: 400 }
      );
    }

    // Check if user already received welcome bonus
    if (profile[0].receivedWelcomeBonus) {
      return Response.json(
        { error: "Welcome bonus already claimed" },
        { status: 400 }
      );
    }

    // Send $1 USDC from treasury
    const result = await sendWelcomeBonus(profile[0].smartAccountAddress);

    // Mark as received in database
    await db
      .update(profilesTable)
      .set({ receivedWelcomeBonus: true })
      .where(eq(profilesTable.userId, user.id));

    return Response.json({
      success: true,
      transactionHash: result.transactionHash,
    });
  } catch (error) {
    console.error("Error sending welcome bonus:", error);
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to send welcome bonus",
      },
      { status: 500 }
    );
  }
}
