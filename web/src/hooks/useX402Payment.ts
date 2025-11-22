"use client";

import { useState, useCallback } from "react";
import { getCurrentUser, toViemAccount } from "@coinbase/cdp-core";
import { wrapFetchWithPayment } from "x402-fetch";

export interface DownloadResult {
  pieceCid: string;
  size: number;
  format: "text" | "binary" | "file";
  content: string;
  filename?: string;
  mimeType?: string;
  type?: string;
  name?: string;
}

/**
 * Hook for handling x402 payments with CDP embedded wallets
 * Uses x402-fetch library with toViemAccount for proper EIP-3009 signatures
 * 
 * This properly creates EIP-3009 authorization signatures for the "exact" scheme,
 * unlike the previous implementation which was trying to send transactions.
 */
export function useX402Payment() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Get viem account from CDP user
   * This is needed for x402-fetch to properly sign EIP-3009 authorizations
   */
  const getViemAccount = useCallback(async () => {
    const user = await getCurrentUser();
    if (!user || !user.evmAccounts || user.evmAccounts.length === 0) {
      throw new Error("No CDP user or EVM accounts found");
    }

    const evmAccount = user.evmAccounts[0];
    const viemAccount = await toViemAccount(evmAccount);
    return viemAccount;
  }, []);

  /**
   * Create a fetch wrapper with automatic x402 payment handling
   * Uses x402-fetch library which handles EIP-3009 signatures properly
   */
  const createPaymentInterceptor = useCallback(
    async () => {
      const viemAccount = await getViemAccount();

      // Use x402-fetch library's wrapFetchWithPayment
      // This automatically handles:
      // 1. Detecting 402 responses
      // 2. Creating EIP-3009 authorization
      // 3. Signing with EIP-712 signTypedData
      // 4. Retrying with X-PAYMENT header
      const wrappedFetch = wrapFetchWithPayment(
        fetch,
        viemAccount,
        BigInt(10 * 10 ** 6) // Max 10 USDC per request
      );

      return wrappedFetch;
    },
    [getViemAccount]
  );

  /**
   * Download with x402 payment handling
   * Uses x402-fetch library which automatically handles 402 responses
   */
  const downloadWithPayment = useCallback(
    async (
      pieceCid: string,
      serverUrl: string = "https://ba-hack-production.up.railway.app"
    ): Promise<DownloadResult> => {
      setIsProcessing(true);
      setError(null);

      try {
        console.log("[X402] Starting download for:", pieceCid);

        // Get wrapped fetch with x402 payment handling
        const wrappedFetch = await createPaymentInterceptor();

        // Make request - x402-fetch will automatically handle 402
        const url = `${serverUrl}/download/${pieceCid}`;
        const response = await wrappedFetch(url, {
          headers: {
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(
            errorData.message || `Download failed: ${response.statusText}`
          );
        }

        const result = await response.json();
        console.log("[X402] Download successful!");
        setIsProcessing(false);
        return result;
      } catch (err: any) {
        console.error("[X402] Error:", err);
        const errorMessage = err.message || "Download failed";
        setError(errorMessage);
        setIsProcessing(false);
        throw new Error(errorMessage);
      }
    },
    [createPaymentInterceptor]
  );

  /**
   * Generic request method with payment interception
   * Uses x402-fetch for automatic 402 handling
   */
  const requestWithPayment = useCallback(
    async (
      path: string,
      options: RequestInit = {},
      serverUrl: string = "https://ba-hack-production.up.railway.app"
    ): Promise<Response> => {
      setIsProcessing(true);
      setError(null);

      try {
        // Get wrapped fetch with x402 payment handling
        const wrappedFetch = await createPaymentInterceptor();

        // Make request with automatic 402 handling
        const url = path.startsWith("http") ? path : `${serverUrl}${path}`;
        const response = await wrappedFetch(url, {
          headers: {
            "Content-Type": "application/json",
            ...((options.headers as Record<string, string>) || {}),
          },
          ...options,
        });

        setIsProcessing(false);
        return response;
      } catch (err: any) {
        console.error("[X402] Error:", err);
        const errorMessage = err.message || "Request failed";
        setError(errorMessage);
        setIsProcessing(false);
        throw new Error(errorMessage);
      }
    },
    [createPaymentInterceptor]
  );

  return {
    downloadWithPayment,
    requestWithPayment,
    createPaymentInterceptor,
    isProcessing,
    error,
  };
}
