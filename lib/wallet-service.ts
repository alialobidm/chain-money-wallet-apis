/**
 * Server-side Alchemy Wallet API Service
 *
 * This service handles all interactions with Alchemy's server-side wallet APIs.
 * Uses a master server private key to manage user smart accounts.
 */

import { privateKeyToAccount } from "viem/accounts";
import { hexToSignature } from "viem";

const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY!;
const ALCHEMY_POLICY_ID = process.env.ALCHEMY_POLICY_ID!;
const MASTER_PRIVATE_KEY = process.env.MASTER_WALLET_PRIVATE_KEY!;

if (!ALCHEMY_API_KEY) {
  throw new Error("ALCHEMY_API_KEY environment variable is not set");
}

if (!ALCHEMY_POLICY_ID) {
  throw new Error("ALCHEMY_POLICY_ID environment variable is not set");
}

if (!MASTER_PRIVATE_KEY) {
  throw new Error("MASTER_WALLET_PRIVATE_KEY environment variable is not set");
}

const ALCHEMY_API_URL = `https://api.g.alchemy.com/v2/${ALCHEMY_API_KEY}`;

// Get the master signer account from private key
const masterAccount = privateKeyToAccount(MASTER_PRIVATE_KEY as `0x${string}`);

interface AlchemyRequest {
  jsonrpc: string;
  method: string;
  params: unknown[];
  id: number;
}

interface AlchemyResponse<T = unknown> {
  jsonrpc: string;
  id: number;
  result?: T;
  error?: {
    code: number;
    message: string;
  };
}

/**
 * Make a JSON-RPC call to Alchemy Wallet API
 */
async function callAlchemyAPI<T>(
  method: string,
  params: unknown[]
): Promise<T> {
  const request: AlchemyRequest = {
    jsonrpc: "2.0",
    method,
    params,
    id: 1,
  };

  const response = await fetch(ALCHEMY_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(`Alchemy API request failed: ${response.statusText}`);
  }

  const data: AlchemyResponse<T> = await response.json();

  if (data.error) {
    throw new Error(`Alchemy API error: ${data.error.message}`);
  }

  if (!data.result) {
    throw new Error("Alchemy API returned no result");
  }

  return data.result;
}

/**
 * Convert a string to a 32-byte hex salt for Alchemy
 */
function stringToHexSalt(str: string): string {
  // Create a hash of the string to get a deterministic hex value
  const encoder = new TextEncoder();
  const data = encoder.encode(str);

  // Convert to hex and pad to 32 bytes (64 hex chars)
  let hex = "0x";
  for (let i = 0; i < data.length && i < 32; i++) {
    hex += data[i].toString(16).padStart(2, "0");
  }
  // Pad remaining bytes with zeros
  while (hex.length < 66) { // 0x + 64 chars = 66
    hex += "00";
  }

  return hex;
}

/**
 * Request or create a smart account for a user
 * This uses the master signer address with a user-specific salt
 */
export async function requestSmartAccount(
  userId: string
): Promise<{ address: string }> {
  // Convert userId to a hex salt
  const salt = stringToHexSalt(userId);

  console.log("Creating smart account for userId:", userId);
  console.log("Generated salt:", salt);
  console.log("Signer address:", masterAccount.address);

  const result = await callAlchemyAPI<{
    accountAddress: string;
    id: string;
  }>("wallet_requestAccount", [
    {
      signerAddress: masterAccount.address,
      creationHint: {
        salt: salt,
        createAdditional: true, // Create a new account even if one exists for this signer
      },
    },
  ]);

  console.log("Result account address:", result.accountAddress);

  return { address: result.accountAddress };
}

interface PreparedCallsResult {
  type: string;
  data: {
    sender: string;
    nonce: string;
    callData: string;
    paymaster: string;
    paymasterData: string;
    paymasterPostOpGasLimit: string;
    paymasterVerificationGasLimit: string;
    maxPriorityFeePerGas: string;
    maxFeePerGas: string;
    callGasLimit: string;
    verificationGasLimit: string;
    preVerificationGas: string;
    factory?: string;
    factoryData?: string;
  };
  chainId: string;
  signatureRequest: {
    type: string;
    data: {
      raw: string;
    };
    rawPayload: string;
  };
  feePayment: {
    sponsored: boolean;
    tokenAddress: string;
    maxAmount: string;
  };
}

/**
 * Prepare calls for a user operation (transaction)
 * Supports both single call and batch calls
 */
export async function prepareCalls(params: {
  from: string;
  calls: Array<{ to: string; data: string; value?: string }>;
  chainId: string;
}): Promise<PreparedCallsResult> {
  const result = await callAlchemyAPI<PreparedCallsResult>(
    "wallet_prepareCalls",
    [
      {
        calls: params.calls.map((call) => ({
          to: call.to,
          data: call.data,
          value: call.value,
        })),
        from: params.from,
        chainId: params.chainId,
        capabilities: {
          paymasterService: {
            policyId: ALCHEMY_POLICY_ID,
          },
        },
      },
    ]
  );

  return result;
}

/**
 * Sign a message hash using the master account
 */
export async function signMessageHash(messageHash: string): Promise<string> {
  const signature = await masterAccount.signMessage({
    message: { raw: messageHash as `0x${string}` },
  });

  return signature;
}

/**
 * Send prepared calls (submit the user operation)
 */
export async function sendPreparedCalls(params: {
  preparedCalls: PreparedCallsResult;
  signature: string;
}): Promise<{ callsId: string }> {
  const { preparedCalls, signature } = params;

  // Parse the signature into v, r, s components
  hexToSignature(signature as `0x${string}`);

  const result = await callAlchemyAPI<
    string | { callsId: string } | { preparedCallIds: string[] }
  >("wallet_sendPreparedCalls", [
    {
      type: preparedCalls.type,
      data: preparedCalls.data,
      chainId: preparedCalls.chainId,
      signature: {
        type: "secp256k1",
        data: signature,
      },
    },
  ]);

  console.log("sendPreparedCalls raw result:", JSON.stringify(result, null, 2));

  // Handle different response formats
  if (typeof result === "string") {
    return { callsId: result };
  }

  // Handle preparedCallIds array format (use first ID)
  if ("preparedCallIds" in result && Array.isArray(result.preparedCallIds)) {
    return { callsId: result.preparedCallIds[0] };
  }

  // Handle callsId object format
  if ("callsId" in result) {
    return result;
  }

  // Fallback - shouldn't reach here but TypeScript needs this
  throw new Error("Unexpected response format from sendPreparedCalls");
}

/**
 * Get the status of a submitted transaction
 */
export async function getCallsStatus(callsId: string): Promise<{
  status: string;
  receipts?: Array<{
    logs: unknown[];
    status: string;
    blockHash: string;
    blockNumber: string;
    gasUsed: string;
    transactionHash: string;
  }>;
}> {
  const result = await callAlchemyAPI<{
    status: string;
    receipts?: Array<{
      logs: unknown[];
      status: string;
      blockHash: string;
      blockNumber: string;
      gasUsed: string;
      transactionHash: string;
    }>;
  }>("wallet_getCallsStatus", [callsId]);

  return result;
}

/**
 * Complete payment flow: prepare, sign, and send
 */
export async function sendPayment(params: {
  fromSmartAccount: string;
  toAddress: string;
  tokenAmount: string;
  callData: string;
  chainId: string;
}): Promise<{ callsId: string; transactionHash?: string }> {
  // Step 1: Prepare the calls
  const prepared = await prepareCalls({
    from: params.fromSmartAccount,
    calls: [
      {
        to: params.toAddress,
        data: params.callData,
      },
    ],
    chainId: params.chainId,
  });

  // Step 2: Sign with master account
  const signature = await signMessageHash(prepared.signatureRequest.data.raw);

  // Step 3: Send the transaction
  const result = await sendPreparedCalls({
    preparedCalls: prepared,
    signature,
  });

  return result;
}
