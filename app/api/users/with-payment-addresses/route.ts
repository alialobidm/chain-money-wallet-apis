import { NextResponse } from "next/server";
import { db } from "@/src/db";
import { profilesTable } from "@/src/db/schema";
import { isNotNull } from "drizzle-orm";

export async function GET() {
  try {
    // Fetch all profiles that have a smart account address set
    const profiles = await db
      .select({
        id: profilesTable.id,
        userId: profilesTable.userId,
        username: profilesTable.username,
        displayName: profilesTable.displayName,
        smartAccountAddress: profilesTable.smartAccountAddress,
      })
      .from(profilesTable)
      .where(isNotNull(profilesTable.smartAccountAddress));

    return NextResponse.json({ users: profiles }, { status: 200 });
  } catch (error) {
    console.error("Error fetching users with smart accounts:", error);
    return NextResponse.json(
      { error: "Failed to fetch users" },
      { status: 500 }
    );
  }
}
