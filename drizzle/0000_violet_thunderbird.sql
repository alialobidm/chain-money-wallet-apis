CREATE TABLE "profiles" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "profiles_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"userId" uuid NOT NULL,
	"username" varchar(50) NOT NULL,
	"displayName" varchar(100) NOT NULL,
	"smartAccountAddress" varchar(255),
	"signerAddress" varchar(255),
	"paymentAddress" varchar(255),
	CONSTRAINT "profiles_userId_unique" UNIQUE("userId"),
	CONSTRAINT "profiles_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "transactions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"transactionHash" varchar(66) NOT NULL,
	"fromUserId" uuid NOT NULL,
	"toUserId" uuid NOT NULL,
	"amount" numeric(20, 6) NOT NULL,
	"message" varchar(500),
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "transactions_transactionHash_unique" UNIQUE("transactionHash")
);
