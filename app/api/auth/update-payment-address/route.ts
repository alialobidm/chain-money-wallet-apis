import { NextRequest, NextResponse } from "next/server";
import { db } from "@/src/db";
import { profilesTable } from "@/src/db/schema";
import { eq } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";

export async function PUT(request: NextRequest) {
  try {
    const { signerAddress } = await request.json();

    // Validate required fields
    if (!signerAddress) {
      return NextResponse.json(
        { error: "Signer address is required" },
        { status: 400 }
      );
    }

    // Get the current user from Supabase auth
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: "User not authenticated" },
        { status: 401 }
      );
    }

    // Get Alchemy API key from environment
    const alchemyApiKey = process.env.ALCHEMY_API_KEY;
    if (!alchemyApiKey) {
      return NextResponse.json(
        { error: "Alchemy API key not configured" },
        { status: 500 }
      );
    }

    // Request smart account from Alchemy
    const alchemyResponse = await fetch(
      `https://api.g.alchemy.com/v2/${alchemyApiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "wallet_requestAccount",
          params: [
            {
              signerAddress: signerAddress,
            },
          ],
          id: 1,
        }),
      }
    );

    if (!alchemyResponse.ok) {
      console.error("Alchemy API error:", await alchemyResponse.text());
      return NextResponse.json(
        { error: "Failed to create smart account" },
        { status: 500 }
      );
    }

    const alchemyData = await alchemyResponse.json();

    if (alchemyData.error) {
      console.error("Alchemy API error:", alchemyData.error);
      return NextResponse.json(
        { error: "Failed to create smart account" },
        { status: 500 }
      );
    }

    // Extract the smart account address from the response
    const smartAccountAddress = alchemyData.result?.accountAddress;
    if (!smartAccountAddress) {
      return NextResponse.json(
        { error: "No smart account address returned" },
        { status: 500 }
      );
    }

    // Update the profile with both signer address and smart account address
    const [updatedProfile] = await db
      .update(profilesTable)
      .set({
        signerAddress,
        paymentAddress: smartAccountAddress, // Use smart account address as payment address
      })
      .where(eq(profilesTable.userId, user.id))
      .returning();

    if (!updatedProfile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    return NextResponse.json(
      {
        profile: updatedProfile,
        smartAccountAddress,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error updating payment address:", error);
    return NextResponse.json(
      { error: "Failed to update payment address" },
      { status: 500 }
    );
  }
}
