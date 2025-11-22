"use client";

import { useState } from "react";
import { useEvmAddress } from "@coinbase/cdp-hooks";
import { createWalletClient, custom, http, type WalletClient } from "viem";
import { baseSepolia } from "viem/chains";

// Extend Window interface for ethereum provider
declare global {
  interface Window {
    ethereum?: any;
  }
}

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
 * Hook for handling x402 payments with Coinbase wallet
 * This handles the 402 Payment Required flow for downloading files
 */
export function useX402Payment() {
  const { evmAddress } = useEvmAddress();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Download with x402 payment handling
   * This function:
   * 1. Attempts to download the file
   * 2. If 402 is returned, processes the payment
   * 3. Retries the download with payment proof
   */
  const downloadWithPayment = async (
    pieceCid: string,
    serverUrl: string = "https://ba-hack-production.up.railway.app"
  ): Promise<DownloadResult> => {
    setIsProcessing(true);
    setError(null);

    try {
      console.log("[X402] Starting download for:", pieceCid);

      // Step 1: Try to download (will likely return 402)
      const downloadUrl = `${serverUrl}/download/${pieceCid}`;
      const initialResponse = await fetch(downloadUrl);

      // Step 2: If 402, handle payment
      if (initialResponse.status === 402) {
        console.log("[X402] Payment required (402), processing payment...");

        const paymentInfo = await initialResponse.json();
        console.log("[X402] Payment info:", paymentInfo);

        if (!paymentInfo.paymentRequest) {
          throw new Error("Invalid payment request from server");
        }

        if (!evmAddress) {
          throw new Error("Wallet not connected");
        }

        // Get the payment request details
        const { to, value, chainId } = paymentInfo.paymentRequest;

        console.log("[X402] Payment details:", {
          to,
          value,
          chainId,
          from: evmAddress,
        });

        // Step 3: Create wallet client using window.ethereum
        const ethereum = (window as any).ethereum;
        if (!ethereum) {
          throw new Error("Ethereum provider not found");
        }

        const walletClient = createWalletClient({
          account: evmAddress as `0x${string}`,
          chain: baseSepolia,
          transport: custom(ethereum),
        });

        // Step 4: Send the payment transaction
        console.log("[X402] Sending payment transaction...");
        const txHash = await walletClient.sendTransaction({
          account: evmAddress as `0x${string}`,
          to: to as `0x${string}`,
          value: BigInt(value),
          chain: baseSepolia,
        });

        console.log("[X402] Payment transaction sent:", txHash);

        // Step 5: Create payment proof header
        // Format: txHash:chainId
        const paymentProof = `${txHash}:${chainId}`;

        console.log("[X402] Payment proof created:", paymentProof);

        // Step 6: Retry download with X-PAYMENT header
        console.log("[X402] Retrying download with payment proof...");
        const retryResponse = await fetch(downloadUrl, {
          headers: {
            "X-PAYMENT": paymentProof,
          },
        });

        if (!retryResponse.ok) {
          const errorData = await retryResponse.json();
          throw new Error(
            errorData.message || `Download failed: ${retryResponse.statusText}`
          );
        }

        const result = await retryResponse.json();
        console.log("[X402] Download successful!");
        setIsProcessing(false);
        return result;
      }

      // Step 7: If not 402, handle normal response
      if (!initialResponse.ok) {
        const errorData = await initialResponse.json();
        throw new Error(
          errorData.message || `Download failed: ${initialResponse.statusText}`
        );
      }

      const result = await initialResponse.json();
      console.log("[X402] Download successful (no payment required)!");
      setIsProcessing(false);
      return result;
    } catch (err: any) {
      console.error("[X402] Error:", err);
      const errorMessage = err.message || "Download failed";
      setError(errorMessage);
      setIsProcessing(false);
      throw new Error(errorMessage);
    }
  };

  return {
    downloadWithPayment,
    isProcessing,
    error,
  };
}
