import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/src/db";
import { profilesTable } from "@/src/db/schema";
import { eq } from "drizzle-orm";

export async function POST(request: NextRequest) {
  try {
    const { to, data, chainId } = await request.json();

    // Validate required fields
    if (!to || !data || !chainId) {
      return NextResponse.json(
        {
          error:
            "Contract address (to), calldata (data), and chainId are required",
        },
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

    // Get user's payment address from database using Drizzle
    const profile = await db
      .select({
        paymentAddress: profilesTable.paymentAddress,
      })
      .from(profilesTable)
      .where(eq(profilesTable.userId, user.id))
      .limit(1);

    if (profile.length === 0 || !profile[0].paymentAddress) {
      return NextResponse.json(
        {
          error: "Payment address not found. Please connect your wallet first.",
        },
        { status: 400 }
      );
    }

    const paymentAddress = profile[0].paymentAddress;

    // Get Alchemy API key from environment
    const alchemyApiKey = process.env.ALCHEMY_API_KEY;
    if (!alchemyApiKey) {
      return NextResponse.json(
        { error: "Alchemy API key not configured" },
        { status: 500 }
      );
    }

    // Get Alchemy Policy ID from environment
    const alchemyPolicyId = process.env.ALCHEMY_POLICY_ID;
    if (!alchemyPolicyId) {
      return NextResponse.json(
        { error: "Alchemy Policy ID not configured" },
        { status: 500 }
      );
    }

    // Prepare the calls payload for Alchemy
    const prepareCalls = {
      jsonrpc: "2.0",
      method: "wallet_prepareCalls",
      params: [
        {
          calls: [
            {
              to: to,
              data: data,
            },
          ],
          from: paymentAddress,
          chainId: chainId,
          capabilities: {
            paymasterService: {
              policyId: alchemyPolicyId,
            },
          },
        },
      ],
      id: 1,
    };

    // Call Alchemy API
    const alchemyResponse = await fetch(
      `https://api.g.alchemy.com/v2/${alchemyApiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(prepareCalls),
      }
    );

    if (!alchemyResponse.ok) {
      console.error("Alchemy API error:", await alchemyResponse.text());
      return NextResponse.json(
        { error: "Failed to prepare calls" },
        { status: 500 }
      );
    }

    const alchemyData = await alchemyResponse.json();

    if (alchemyData.error) {
      console.error("Alchemy API error:", alchemyData.error);
      return NextResponse.json(
        { error: `Failed to prepare calls: ${alchemyData.error.message}` },
        { status: 500 }
      );
    }

    // Return the prepared calls data
    return NextResponse.json(
      {
        result: alchemyData.result,
        from: paymentAddress,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error preparing calls:", error);
    return NextResponse.json(
      { error: "Failed to prepare calls" },
      { status: 500 }
    );
  }
}
