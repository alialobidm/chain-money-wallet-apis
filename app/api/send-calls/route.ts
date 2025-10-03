import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/src/db";
import { transactionsTable } from "@/src/db/schema";

export async function POST(request: NextRequest) {
  try {
    const { preparedCallsData, signature, recipientUserId, amount, message } =
      await request.json();

    // Validate required fields
    if (!preparedCallsData || !signature) {
      return NextResponse.json(
        { error: "Prepared calls data and signature are required" },
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

    // Prepare the send calls payload for Alchemy
    // Extract only the fields Alchemy expects, excluding signatureRequest
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { signatureRequest, ...cleanPreparedData } = preparedCallsData;

    const sendCalls = {
      jsonrpc: "2.0",
      method: "wallet_sendPreparedCalls",
      params: [
        {
          ...cleanPreparedData,
          signature: {
            type: "secp256k1",
            data: signature,
          },
        },
      ],
      id: 1,
    };

    const alchemyResponse = await fetch(
      `https://api.g.alchemy.com/v2/${alchemyApiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(sendCalls),
      }
    );

    if (!alchemyResponse.ok) {
      console.error("Alchemy API error:", await alchemyResponse.text());
      return NextResponse.json(
        { error: "Failed to send calls" },
        { status: 500 }
      );
    }

    const alchemyData = await alchemyResponse.json();

    if (alchemyData.error) {
      console.error("Alchemy API error:", alchemyData.error);
      return NextResponse.json(
        { error: `Failed to send calls: ${alchemyData.error.message}` },
        { status: 500 }
      );
    }

    // Poll for transaction status with timeout
    let transactionHash;
    const startTime = Date.now();
    const maxWaitTime = 10000; // 10 seconds
    const pollInterval = 250; // 250ms

    while (Date.now() - startTime < maxWaitTime) {
      try {
        const getCallsStatus = {
          jsonrpc: "2.0",
          method: "wallet_getCallsStatus",
          params: alchemyData.result.preparedCallIds,
          id: 1,
        };

        const statusResponse = await fetch(
          `https://api.g.alchemy.com/v2/${alchemyApiKey}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(getCallsStatus),
          }
        );

        if (statusResponse.ok) {
          const statusData = await statusResponse.json();
          if (statusData.result && statusData.result.receipts) {
            const { receipts } = statusData.result;
            if (receipts.length > 0 && receipts[0].transactionHash) {
              transactionHash = receipts[0].transactionHash;
              break; // Successfully got transaction hash, exit polling
            }
          }
        }
      } catch (pollError) {
        console.error("Error during status polling:", pollError);
      }

      // Wait before next poll
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }

    // Log if we timed out without getting a transaction hash
    if (!transactionHash) {
      console.warn("Timed out waiting for transaction hash after", maxWaitTime, "ms");
    }

    // Store transaction in database if we have transaction details
    if (recipientUserId && amount && transactionHash) {
      try {
        await db.insert(transactionsTable).values({
          transactionHash: transactionHash,
          fromUserId: user.id,
          toUserId: recipientUserId,
          amount: amount,
          message: message || null,
        });
      } catch (dbError) {
        console.error("Error storing transaction:", dbError);
        // Don't fail the API call if DB storage fails, but log it
      }
    }

    // Return the transaction result
    return NextResponse.json(
      {
        result: alchemyData.result,
        transactionHash: transactionHash,
        callsId: alchemyData.result?.callsId,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error sending calls:", error);
    return NextResponse.json(
      { error: "Failed to send calls" },
      { status: 500 }
    );
  }
}
