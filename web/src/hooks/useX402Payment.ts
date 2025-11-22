"use client";

import { useState, useCallback, useMemo } from "react";
import { useEvmAddress, useSendEvmTransaction } from "@coinbase/cdp-hooks";
import { encodeFunctionData, type Hex } from "viem";
import { wrapFetchWithPayment, decodeXPaymentResponse } from "x402-fetch";

export interface PaymentRequiredResponse {
  paymentRequest: {
    to: string;
    value: string;
    chainId: number;
    data?: string;
  };
  message?: string;
}

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
 * Uses official x402-fetch library with CDP hooks adapter
 */
export function useX402Payment() {
  const { evmAddress } = useEvmAddress();
  const { sendEvmTransaction } = useSendEvmTransaction();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Create a viem-compatible account adapter for CDP hooks
   * This allows x402-fetch to work with CDP embedded wallets
   */
  const cdpAccount = useMemo(() => {
    if (!evmAddress) return null;

    // Map network name to chainId for transaction
    const networkToChainId: Record<string, number> = {
      "base-sepolia": 84532,
      base: 8453,
      ethereum: 1,
      sepolia: 11155111,
    };

    // Create a viem-compatible account object
    return {
      address: evmAddress as `0x${string}`,
      type: "custom" as const,

      // Sign and send transaction using CDP hooks
      signTransaction: async (tx: any) => {
        console.log("[X402 CDP Account] Signing transaction:", tx);

        const network = tx.network || "base-sepolia";
        const chainId = tx.chainId || networkToChainId[network] || 84532;

        // Check if this is an ERC20 transfer (has data field)
        const isErc20 = tx.data && tx.data !== "0x";

        let result;
        if (isErc20) {
          // ERC20 token payment
          console.log("[X402 CDP Account] Sending ERC20 payment...");
          result = await sendEvmTransaction({
            transaction: {
              to: tx.to,
              data: tx.data as Hex,
              value: BigInt(0),
              chainId: chainId,
              type: "eip1559",
            },
            evmAccount: evmAddress as `0x${string}`,
            network: network as any,
          });
        } else {
          // Native token payment
          console.log("[X402 CDP Account] Sending native payment...");
          result = await sendEvmTransaction({
            transaction: {
              to: tx.to,
              value: BigInt(tx.value || 0),
              chainId: chainId,
              type: "eip1559",
            },
            evmAccount: evmAddress as `0x${string}`,
            network: network as any,
          });
        }

        console.log(
          "[X402 CDP Account] Transaction sent:",
          result.transactionHash
        );
        return result.transactionHash as Hex;
      },

      // Required for x402-fetch compatibility
      async sendTransaction(tx: any) {
        return this.signTransaction(tx);
      },
    };
  }, [evmAddress, sendEvmTransaction]);

  /**
   * Create fetch client with x402 payment handling
   * Uses official x402-fetch library
   */
  const fetchWithPayment = useMemo(() => {
    if (!cdpAccount) return null;
    return wrapFetchWithPayment(fetch, cdpAccount as any);
  }, [cdpAccount]);

  /**
   * Download with x402 payment handling using official x402-fetch
   */
  const downloadWithPayment = useCallback(
    async (
      pieceCid: string,
      serverUrl: string = "https://ba-hack-production.up.railway.app"
    ): Promise<DownloadResult> => {
      if (!fetchWithPayment) {
        throw new Error("CDP wallet not connected");
      }

      setIsProcessing(true);
      setError(null);

      try {
        console.log("[X402] Starting download for:", pieceCid);

        const url = `${serverUrl}/download/${pieceCid}`;

        // Use official x402-fetch - automatically handles 402 and payments
        const response = await fetchWithPayment(url, {
          method: "GET",
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

        // Decode payment response if present
        const paymentResponseHeader =
          response.headers.get("x-payment-response");
        if (paymentResponseHeader) {
          const paymentResponse = decodeXPaymentResponse(paymentResponseHeader);
          console.log("[X402] Payment response:", paymentResponse);
        }

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
    [fetchWithPayment]
  );

  /**
   * Generic request method with automatic x402 payment handling
   */
  const requestWithPayment = useCallback(
    async (url: string, options: RequestInit = {}): Promise<Response> => {
      if (!fetchWithPayment) {
        throw new Error("CDP wallet not connected");
      }

      setIsProcessing(true);
      setError(null);

      try {
        console.log("[X402] Making request to:", url);

        // Use official x402-fetch - automatically handles 402 and payments
        const response = await fetchWithPayment(url, {
          ...options,
          headers: {
            "Content-Type": "application/json",
            ...((options.headers as Record<string, string>) || {}),
          },
        });

        // Decode payment response if present
        const paymentResponseHeader =
          response.headers.get("x-payment-response");
        if (paymentResponseHeader) {
          const paymentResponse = decodeXPaymentResponse(paymentResponseHeader);
          console.log("[X402] Payment response:", paymentResponse);
        }

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
    [fetchWithPayment]
  );

  return {
    downloadWithPayment,
    requestWithPayment,
    fetchWithPayment,
    isProcessing,
    error,
  };
}
