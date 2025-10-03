import { createClient } from "@/lib/supabase/server";
import { requestSmartAccount } from "@/lib/wallet-service";
import { db } from "@/src/db";
import { profilesTable } from "@/src/db/schema";
import { eq } from "drizzle-orm";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user already has a smart account
    const existingProfile = await db
      .select()
      .from(profilesTable)
      .where(eq(profilesTable.userId, user.id))
      .limit(1);

    if (
      existingProfile.length > 0 &&
      existingProfile[0].smartAccountAddress
    ) {
      return Response.json({
        smartAccountAddress: existingProfile[0].smartAccountAddress,
        alreadyInitialized: true,
      });
    }

    // Request a smart account from Alchemy
    console.log("Requesting smart account for user:", user.id);
    const result = await requestSmartAccount(user.id);
    console.log("Smart account result:", result);

    const smartAccountAddress = result.address;

    if (!smartAccountAddress) {
      throw new Error("Failed to get smart account address from Alchemy");
    }

    console.log("Updating profile with address:", smartAccountAddress);

    // Update the profile with the smart account address
    await db
      .update(profilesTable)
      .set({ smartAccountAddress })
      .where(eq(profilesTable.userId, user.id));

    // Send welcome bonus asynchronously (don't wait for it)
    // This happens in the background so user doesn't have to wait
    fetch(
      `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/api/wallet/send-welcome-bonus`,
      {
        method: "POST",
        headers: {
          Cookie: request.headers.get("Cookie") || "",
        },
      }
    ).catch((error) => {
      console.error("Failed to send welcome bonus:", error);
      // Don't fail the initialization if bonus fails
    });

    return Response.json({
      smartAccountAddress,
      alreadyInitialized: false,
    });
  } catch (error) {
    console.error("Error initializing wallet:", error);
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to initialize wallet",
      },
      { status: 500 }
    );
  }
}
