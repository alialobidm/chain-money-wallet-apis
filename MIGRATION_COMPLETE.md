# Migration to Server-Side Wallets - COMPLETE ✅

## What Was Changed

### 1. Database Schema (`src/db/schema.ts`)
- ✅ Added `smartAccountAddress` field to profiles table
- Kept legacy `signerAddress` and `paymentAddress` for backward compatibility

### 2. Server-Side Wallet Service (`lib/wallet-service.ts`)
- ✅ Created complete wrapper around Alchemy Wallet API
- ✅ Implements master key approach (one server key controls all user wallets)
- ✅ Functions:
  - `requestSmartAccount()` - Create/get smart account for user
  - `prepareCalls()` - Prepare transaction
  - `signMessageHash()` - Sign with master key
  - `sendPreparedCalls()` - Submit transaction
  - `getCallsStatus()` - Poll for transaction status
  - `sendPayment()` - Complete flow in one function

### 3. New API Endpoints

#### `/api/wallet/initialize` (POST)
- Initializes a smart account for authenticated user
- Called automatically on signup
- Can be called manually if needed

#### `/api/wallet/send-payment` (POST)
- Sends payment entirely server-side
- No client-side signing required
- Body: `{ recipientUserId, amount, message, chainId }`

### 4. Updated Components

#### `send-payment-modal.tsx`
- ✅ Removed all wagmi hooks (`useAccount`, `useSignMessage`, etc.)
- ✅ Simplified to single API call
- ✅ No wallet connection required
- ✅ Much simpler user experience

#### `app/wallet/page.tsx`
- ✅ Removed `WalletConnect` component
- Now just shows balance and transactions

#### `app/layout.tsx`
- ✅ Removed `WagmiConfigProvider`

### 5. User Signup Flow (`app/api/auth/create-profile/route.ts`)
- ✅ Now automatically creates smart account on signup
- Users get wallet immediately upon registration

### 6. Dependencies Removed
- ✅ Uninstalled `wagmi`, `@wagmi/core`, `@wagmi/connectors`
- ✅ Removed 307 packages!
- Kept `viem` for utility functions (encoding, etc.)

### 7. Files That Can Be Deleted
- `/components/wallet-connect.tsx` - No longer used
- `/components/providers/wagmi-provider.tsx` - No longer used
- `/lib/wagmi.ts` - No longer used

## Next Steps

### 1. Add Environment Variable
Add this to your `.env` file:
```bash
MASTER_WALLET_PRIVATE_KEY=0x...  # Generate a new private key for the master wallet
```

**To generate a new private key:**
```bash
node -e "console.log('0x' + require('crypto').randomBytes(32).toString('hex'))"
```

⚠️ **IMPORTANT**: Keep this key secure! In production, use a secrets manager.

### 2. Run Database Migration
```bash
# Generate migration
npm run drizzle-kit generate

# Push to database
npm run drizzle-kit push
```

This will add the `smart_account_address` column to the profiles table.

### 3. Update Users Endpoint (Optional)
The `/api/users/with-payment-addresses` endpoint should be updated to return `smartAccountAddress` instead of `paymentAddress`. Or we can keep both for backward compatibility during migration.

### 4. Test the Flow

**Test new user signup:**
1. Sign up a new user
2. Check they get a `smartAccountAddress` automatically
3. Try sending a payment

**Test existing users:**
- Existing users with `paymentAddress` can be migrated by calling `/api/wallet/initialize`

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                        User                              │
│              (Authenticated via Supabase)                │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│              Client (Browser)                            │
│  - Simple "Send Payment" button                          │
│  - No wallet connection required                         │
└─────────────────────┬───────────────────────────────────┘
                      │
                      │ POST /api/wallet/send-payment
                      │ { recipientUserId, amount, message }
                      ▼
┌─────────────────────────────────────────────────────────┐
│              Next.js Server                              │
│  1. Verify user authentication                           │
│  2. Get sender's smartAccountAddress from DB             │
│  3. Get recipient's smartAccountAddress from DB          │
│  4. Encode transfer call data                            │
│  5. Call Alchemy prepareCalls                            │
│  6. Sign with MASTER_PRIVATE_KEY                         │
│  7. Call Alchemy sendPreparedCalls                       │
│  8. Poll for transaction hash                            │
│  9. Store transaction in DB                              │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│           Alchemy Wallet API                             │
│  - Manages smart accounts                                │
│  - Handles gas sponsorship (paymaster)                   │
│  - Submits to blockchain                                 │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│         Arbitrum Sepolia Blockchain                      │
│  - Token transfer executed                               │
│  - Transaction confirmed                                 │
└─────────────────────────────────────────────────────────┘
```

## Key Benefits

✅ **No wallet installation** - Users don't need MetaMask or any wallet
✅ **One-click payments** - Single button, no popups or approvals
✅ **Smaller bundle** - Removed 300+ packages
✅ **Better UX** - Seamless, no wallet connection friction
✅ **Gasless** - Using Alchemy paymaster
✅ **Production-ready architecture** - Easy to upgrade to HSM/MPC later

## Security Notes

### Current (Demo) Setup
- Single master private key stored in env var
- Server signs all transactions
- Supabase auth is the security boundary

### Production Upgrades
When ready for production:
1. Move key to AWS Secrets Manager or similar
2. Add MPC (multi-party computation) via Fireblocks/BitGo
3. Add HSM for key storage
4. Implement spending limits and rate limiting
5. Add multi-sig for large transactions

The code is structured to make these upgrades easy - just swap out the `masterAccount` signer in `wallet-service.ts`.

## Troubleshooting

### "MASTER_WALLET_PRIVATE_KEY not set"
- Add the env var to `.env`
- Restart your dev server

### "Failed to initialize wallet"
- Check your Alchemy API key
- Make sure policy ID is correct
- Check network logs for Alchemy API errors

### User has no smart account
- Call `/api/wallet/initialize` manually
- Or sign up a new account (automatic initialization)

### Transaction fails
- Check Alchemy policy has sufficient gas credits
- Verify token contract address is correct
- Check recipient has smartAccountAddress set

## Migration Status

✅ Server-side wallet service created
✅ API endpoints implemented
✅ Client components updated
✅ Signup flow updated
✅ Dependencies cleaned up
⏳ Need to add MASTER_WALLET_PRIVATE_KEY to .env
⏳ Need to run database migration
⏳ Ready for testing!
