import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/src/db";
import { transactionsTable, profilesTable } from "@/src/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET() {
  try {
    // Get the current user from Supabase auth to ensure they're logged in
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

    // Fetch all transactions from the platform
    const transactions = await db
      .select({
        id: transactionsTable.id,
        transactionHash: transactionsTable.transactionHash,
        fromUserId: transactionsTable.fromUserId,
        toUserId: transactionsTable.toUserId,
        amount: transactionsTable.amount,
        message: transactionsTable.message,
        createdAt: transactionsTable.createdAt,
        // Sender profile info
        senderDisplayName: profilesTable.displayName,
        senderUsername: profilesTable.username,
      })
      .from(transactionsTable)
      .leftJoin(
        profilesTable,
        eq(transactionsTable.fromUserId, profilesTable.userId)
      )
      .orderBy(desc(transactionsTable.createdAt))
      .limit(20); // Show more transactions for global feed

    // For each transaction, get the recipient info
    const enrichedTransactions = await Promise.all(
      transactions.map(async (transaction) => {
        const recipient = await db
          .select({
            displayName: profilesTable.displayName,
            username: profilesTable.username,
          })
          .from(profilesTable)
          .where(eq(profilesTable.userId, transaction.toUserId))
          .limit(1);

        return {
          id: transaction.id,
          transactionHash: transaction.transactionHash,
          amount: transaction.amount,
          message: transaction.message,
          createdAt: transaction.createdAt,
          fromUserId: transaction.fromUserId,
          toUserId: transaction.toUserId,
          senderDisplayName: transaction.senderDisplayName,
          senderUsername: transaction.senderUsername,
          recipientDisplayName: recipient.length > 0 ? recipient[0].displayName : "Unknown",
          recipientUsername: recipient.length > 0 ? recipient[0].username : "unknown",
        };
      })
    );

    return NextResponse.json({ transactions: enrichedTransactions }, { status: 200 });
  } catch (error) {
    console.error("Error fetching all transactions:", error);
    return NextResponse.json(
      { error: "Failed to fetch transactions" },
      { status: 500 }
    );
  }
}