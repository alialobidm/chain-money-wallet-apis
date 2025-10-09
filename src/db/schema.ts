import {
  integer,
  pgTable,
  varchar,
  uuid,
  timestamp,
  decimal,
  boolean,
} from "drizzle-orm/pg-core";

export const profilesTable = pgTable("profiles", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  userId: uuid().notNull().unique(), // Links to Supabase auth.users
  username: varchar({ length: 50 }).notNull().unique(),
  displayName: varchar({ length: 100 }).notNull(),
  smartAccountAddress: varchar({ length: 255 }), // Alchemy smart account address
  receivedWelcomeBonus: boolean().default(false).notNull(), // Track if user received $1 welcome bonus
  isEarningYield: boolean().default(false).notNull(), // Track if user has yield earning enabled
});

export const transactionsTable = pgTable("transactions", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  transactionHash: varchar({ length: 66 }).notNull().unique(), // 0x prefix + 64 hex chars
  fromUserId: uuid().notNull(), // References profiles.userId
  toUserId: uuid().notNull(), // References profiles.userId
  amount: decimal({ precision: 20, scale: 6 }).notNull(), // Support up to 6 decimal places
  message: varchar({ length: 500 }), // Optional message
  createdAt: timestamp().notNull().defaultNow(),
});
