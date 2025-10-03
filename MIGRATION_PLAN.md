# Server-Side Wallet Migration Plan

## Overview
Migrate from client-side wallet connections (MetaMask/WalletConnect) to fully server-side wallet management using Alchemy's Wallet API.

## Key Solution: Session Keys (No Private Key Storage!)

**Good news**: You don't need to store private keys! Instead, use Alchemy's **session keys** approach:

1. **Server generates ephemeral session key pair** (stored server-side)
2. **Call `wallet_createSession`** to authorize this session key for the user's smart account
3. **Session key can sign transactions** on behalf of the user with configurable permissions and expiry
4. **Store**: `session_public_key`, `session_private_key` (ephemeral), `smart_account_address`, `expiry`

This means:
- ✅ User's main wallet private key **never** touches your server
- ✅ Session keys are scoped with permissions (e.g., spending limits, time-based)
- ✅ Session keys expire automatically
- ✅ User authenticates via Supabase → server manages their session key → seamless payments

## Migration Steps

### Phase 1: Update Database Schema
**Add to users table:**
```sql
- session_public_key: string (the public key authorized for this session)
- session_private_key: encrypted string (stored securely, used server-side to sign)
- session_expiry: timestamp
- smart_account_address: string (from wallet_requestAccount)
```

**Update transactions table:**
- Remove client-side transaction fields if any
- Ensure we track: user_id, amount, recipient, status, tx_hash, chain_id

### Phase 2: Remove Client-Side Wallet Code

**Remove these dependencies from package.json:**
- `wagmi`
- `@wagmi/core`
- `@wagmi/connectors`
- `viem` (unless used for other utils)

**Delete/Archive these files:**
- Any wallet provider components
- WalletConnect configuration
- Client-side signing logic
- `useWallet` or similar hooks that connect to MetaMask

### Phase 3: Implement Server-Side Wallet Service

**Create `/app/api/wallet/` endpoints:**

1. **`POST /api/wallet/initialize`** (called on first user signup/login)
   - Generate ephemeral key pair for session key
   - Call `wallet_requestAccount` with a signer address (you can generate a unique signer per user)
   - Call `wallet_createSession` to authorize the session key for this smart account
   - Store session key + smart account address in database
   - Return smart account address to client

2. **`POST /api/wallet/send-payment`** (replaces all client-side payment flows)
   ```typescript
   // Input: { recipientAddress, amount, chainId }
   // Process:
   // 1. Get user's session key from DB
   // 2. Call wallet_prepareCalls (build user operation)
   // 3. Sign the signatureRequest with session private key
   // 4. Call wallet_sendPreparedCalls (submit transaction)
   // 5. Return transaction hash
   ```

3. **`GET /api/wallet/status/:txId`**
   - Call `wallet_getCallsStatus` to check transaction status
   - Return status to client

4. **`POST /api/wallet/refresh-session`** (optional, for expiring sessions)
   - Generate new session key
   - Call `wallet_createSession` again
   - Update database

### Phase 4: Update Client-Side UI

**Simplify payment flow:**
```typescript
// Old: Multi-step wallet connection, approval, signing
// New: Single API call
const sendPayment = async (recipient: string, amount: string) => {
  const response = await fetch('/api/wallet/send-payment', {
    method: 'POST',
    body: JSON.stringify({ recipient, amount, chainId: '0x01' })
  });
  const { txHash } = await response.json();
  return txHash;
}
```

**Update components:**
- Remove wallet connection buttons
- Remove "Connect Wallet" prompts
- Replace multi-step UIs with single "Send Payment" button
- Show payment status via polling `/api/wallet/status/:txId`

### Phase 5: Update User Onboarding

**New flow:**
1. User signs up via Supabase auth (email/OAuth)
2. Backend automatically calls `/api/wallet/initialize`
3. User gets a smart account address immediately
4. No wallet installation required!

### Phase 6: Security Considerations

**Session key storage:**
- Encrypt session private keys in database (use Supabase's encryption or KMS)
- Session keys should have short expiry (e.g., 7-30 days)
- Implement rotation strategy

**Permissions:**
- Use `wallet_createSession` permissions to limit what session keys can do
- Example: spending limits, specific contract interactions only

**Rate limiting:**
- Add rate limits to `/api/wallet/send-payment`
- Prevent abuse

### Phase 7: Testing Plan

1. Test wallet initialization for new users
2. Test payment flow end-to-end
3. Test session expiry handling
4. Test concurrent payments
5. Test error scenarios (insufficient funds, network issues)

## Files to Modify/Create

### Create:
- `/app/api/wallet/initialize/route.ts`
- `/app/api/wallet/send-payment/route.ts`
- `/app/api/wallet/status/[txId]/route.ts`
- `/lib/wallet-service.ts` (core wallet API wrapper)
- `/lib/session-key-manager.ts` (session key generation/management)

### Modify:
- `/package.json` (remove wagmi, viem, etc.)
- `/app/api/signup/route.ts` (add wallet initialization)
- `/components/*` payment UI components (simplify)
- `/db/schema.ts` (add session key fields)

### Delete:
- Any `use client` wallet components
- WalletConnect provider configs
- Client-side signing utilities

## Timeline Estimate
- Phase 1 (DB): 1 day
- Phase 2 (Remove client code): 1 day
- Phase 3 (Server API): 2-3 days
- Phase 4 (Update UI): 1-2 days
- Phase 5 (Onboarding): 1 day
- Phase 6 (Security): 1 day
- Phase 7 (Testing): 1-2 days

**Total: ~8-11 days**

## Benefits After Migration
- ✅ No wallet installation required for users
- ✅ Seamless one-click payments
- ✅ Better UX (no MetaMask popups)
- ✅ Gasless transactions (using paymaster)
- ✅ Server controls flow = better error handling
- ✅ Reduced client bundle size (remove wagmi, viem)
