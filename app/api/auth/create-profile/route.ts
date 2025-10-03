import { NextRequest, NextResponse } from "next/server";
import { db } from "@/src/db";
import { profilesTable } from "@/src/db/schema";
import { requestSmartAccount } from "@/lib/wallet-service";
import { sendWelcomeBonus } from "@/lib/treasury-service";
import { eq } from "drizzle-orm";

export async function POST(request: NextRequest) {
  try {
    const { userId, username, displayName } = await request.json();

    // Validate required fields
    if (!userId || !username || !displayName) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Request a smart account from Alchemy for this user
    const { address } = await requestSmartAccount(userId);
    const smartAccountAddress = address;
    console.log(`Created smart account ${address} for user ${userId}`);

    // Insert the profile into the database
    const [profile] = await db
      .insert(profilesTable)
      .values({
        userId,
        username,
        displayName,
        smartAccountAddress,
      })
      .returning();

    // Send welcome bonus in the background if smart account was created
    if (smartAccountAddress) {
      sendWelcomeBonus(smartAccountAddress)
        .then(() => {
          console.log(`Welcome bonus sent to ${smartAccountAddress}`);
          // Mark as received in database
          return db
            .update(profilesTable)
            .set({ receivedWelcomeBonus: true })
            .where(eq(profilesTable.userId, userId));
        })
        .catch((error) => {
          console.error("Failed to send welcome bonus:", error);
          // Don't fail profile creation if bonus fails
        });
    }

    return NextResponse.json({ profile }, { status: 201 });
  } catch (error) {
    console.error("Error creating profile:", error);

    // Handle unique constraint violations
    if (error instanceof Error && error.message.includes("unique")) {
      return NextResponse.json(
        { error: "Username already exists" },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "Failed to create profile" },
      { status: 500 }
    );
  }
}
