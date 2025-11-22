# X402 Payment Issue Fix

## The Problem

Your `useX402Payment.ts` hook was incorrectly implementing the x402 "exact" scheme payment flow. The middleware was receiving undefined payment data:

```
[DYNAMIC_PRICING]   - Decoded payment data: {
  network: undefined,
  paymentType: undefined,
  transaction: 'none',
  hasSignature: false
}
```

## Root Cause

The x402 protocol's "exact" scheme on EVM requires **EIP-3009 authorization signatures**, NOT blockchain transactions.

### What You Were Doing (WRONG):
1. Sending an actual ERC20 `transfer` transaction to the blockchain
2. Getting a transaction hash back
3. Sending that transaction hash in the X-PAYMENT header

### What You Should Do (CORRECT):
1. Create an **authorization object** (EIP-3009)
2. Sign it with **EIP-712 typed data signing** (not a transaction!)
3. Send the **signature + authorization** in the X-PAYMENT header

## The Correct X-PAYMENT Format

For the "exact" scheme on EVM, the X-PAYMENT header must be base64-encoded JSON with this structure:

```json
{
  "x402Version": 1,
  "scheme": "exact",
  "network": "base-sepolia",  // ← Must be at top level
  "payload": {
    "signature": "0x...",  // ← EIP-712 signature
    "authorization": {
      "from": "0x...",
      "to": "0x...",
      "value": "10000",
      "validAfter": "1740672089",
      "validBefore": "1740672154",
      "nonce": "0x..."
    }
  }
}
```

### Your Previous Format (WRONG):
```json
{
  "x402Version": 1,
  "scheme": "exact",
  "payload": {
    "transactionHash": "0x...",  // ← Wrong! Should be signature + authorization
    "network": "base-sepolia"    // ← Wrong! Network should be at top level
  }
}
```

## The Solution

Instead of manually implementing the EIP-3009 signature flow, use the **x402-fetch** library (which you already have installed):

### Before:
```typescript
// Manually sending transactions (WRONG)
const result = await sendEvmTransaction({...});
const txHash = result.transactionHash;
```

### After:
```typescript
// Using x402-fetch with proper viem account
const user = await getCurrentUser();
const viemAccount = await toViemAccount(user.evmAccounts[0]);
const wrappedFetch = wrapFetchWithPayment(fetch, viemAccount, maxAmount);
const response = await wrappedFetch(url, options);
```

## Why This Works

The `x402-fetch` library (and `x402-axios`) automatically:
1. Detects 402 responses
2. Creates proper EIP-3009 authorization objects
3. Signs them with EIP-712 `signTypedData` (requires viem account)
4. Formats the X-PAYMENT header correctly
5. Retries the request with the payment proof

The key is using `toViemAccount` from `@coinbase/cdp-core` to convert your CDP embedded wallet account into a viem account, which supports `signTypedData`.

## How the MCP Example Works

The `mcp-embedded-wallet` example works because it:
1. Uses `@coinbase/cdp-core` (not just hooks)
2. Calls `toViemAccount(evmAccount)` to get a viem-compatible account
3. Passes that to `withPaymentInterceptor` from `x402-axios`

## Key Takeaways

1. **Never send actual transactions for x402 exact scheme** - only signatures
2. **Use the x402 libraries** - they handle the complex EIP-3009 flow
3. **Use `toViemAccount`** - CDP hooks alone don't expose `signTypedData`
4. **Network goes at top level** - not inside the payload object
5. **Payload contains signature + authorization** - not transaction hashes

## References

- x402 Exact Scheme Spec: `/x402/specs/schemes/exact/scheme_exact_evm.md`
- MCP Example: `/x402/examples/typescript/mcp-embedded-wallet/`
- x402-fetch: Package you already have installed
- EIP-3009: `transferWithAuthorization` standard for USDC

