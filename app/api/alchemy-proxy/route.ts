import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { method, params, id = 1 } = await request.json();

    // Validate required fields
    if (!method) {
      return NextResponse.json(
        { error: "Method is required" },
        { status: 400 }
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

    // Prepare the request payload for Alchemy
    const alchemyPayload = {
      jsonrpc: "2.0",
      method: method,
      params: params || [],
      id: id,
    };

    // Call Alchemy API
    const alchemyResponse = await fetch(
      `https://base-sepolia.g.alchemy.com/v2/${alchemyApiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(alchemyPayload),
      }
    );

    if (!alchemyResponse.ok) {
      console.error("Alchemy API error:", await alchemyResponse.text());
      return NextResponse.json(
        { error: "Failed to call Alchemy API" },
        { status: 500 }
      );
    }

    const alchemyData = await alchemyResponse.json();

    if (alchemyData.error) {
      console.error("Alchemy API error:", alchemyData.error);
      return NextResponse.json(
        { error: `Alchemy API error: ${alchemyData.error.message}` },
        { status: 500 }
      );
    }

    // Return the result from Alchemy
    return NextResponse.json(alchemyData, { status: 200 });
  } catch (error) {
    console.error("Error in Alchemy proxy:", error);
    return NextResponse.json(
      { error: "Failed to proxy request to Alchemy" },
      { status: 500 }
    );
  }
}