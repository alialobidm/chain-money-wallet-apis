# ChainMoney Demo

A simple payment application with server-side smart account wallets, USDC transfers, and gasless transactions on Arbitrum Sepolia. Earn interest on idle USDC balances with Aave integration.

## Quick Start

### 1. Clone and Install

```bash
git clone <your-repo-url>
cd onchain-payments
npm install
```

### 2. Set Up Environment Variables

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Then fill in the required values:

#### **Supabase** (Authentication)

- Get from: https://app.supabase.com/project/_/settings/api
- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Your Supabase anonymous key

#### **Database** (PostgreSQL)

- Can be any PostgreSQL database, including Supabase
- For Supabase: https://app.supabase.com/project/_/settings/database
- `DATABASE_URL` - Full PostgreSQL connection string

#### **Alchemy** (Smart Account Wallets)

- Get from: https://dashboard.alchemy.com/
- Create an app and a gas policy
- `ALCHEMY_API_KEY` - Your Alchemy API key
- `ALCHEMY_POLICY_ID` - Your Alchemy gas sponsorship policy ID
- ⚠️ These are server-side only and never exposed to the client

#### **Master Wallet** (Transaction Signing)

- Generate a new private key:
  ```bash
  node -e "console.log('0x' + require('crypto').randomBytes(32).toString('hex'))"
  ```
- `MASTER_WALLET_PRIVATE_KEY` - The generated private key

**⚠️ Security Note:** This master wallet approach is for demo purposes only. In production, use:

- Hardware Security Modules (HSM)
- Multi-Party Computation (MPC) services (e.g., Fireblocks, BitGo)
- Secure key management systems (e.g., AWS KMS, HashiCorp Vault)
- Multi-signature setups

Different institutions have different security practices for private key management. Choose the approach that fits your security requirements.

### 3. Set Up Database

Push the database schema to your PostgreSQL database:

```bash
npm run db:push
```

This uses [Drizzle Kit](https://orm.drizzle.team/kit-docs/overview) to read your schema from `src/db/schema.ts` and create the tables directly. For future schema changes, you can use [Drizzle migrations](https://orm.drizzle.team/docs/migrations) to track changes over time.

### 4. Run the App

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000)

## How It Works

1. **Sign Up** - Users create an account with email/password
2. **Smart Account** - A smart account wallet is automatically created for each user
3. **Get USDC** - Users get testnet USDC from Circle's faucet
4. **Send Payments** - Send gasless USDC payments to other users
5. **Earn Interest** - Toggle on Aave to automatically earn interest on idle USDC balances
6. **View Transactions** - See all transactions on Arbitrum Sepolia

## Tech Stack

- **Next.js 14** - App Router
- **Supabase** - Authentication and PostgreSQL database
- **Alchemy** - Smart account wallet infrastructure
- **Aave** - For earning interest on the USDC
- **Arbitrum Sepolia** - Testnet blockchain
- **USDC** - Real testnet USDC token
- **Tailwind CSS + shadcn/ui** - Styling and components

## Key Features

- ✅ No wallet installation required for users
- ✅ One-click gasless payments
- ✅ Server-side transaction signing
- ✅ Real USDC on Arbitrum Sepolia testnet
- ✅ Earn interest with Aave - simple toggle to start earning
- ✅ Transaction history and receipts
