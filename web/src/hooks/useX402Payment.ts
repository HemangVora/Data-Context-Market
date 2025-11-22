"use client";

import { useState } from "react";
import { useEvmAddress, useSendEvmTransaction } from "@coinbase/cdp-hooks";
import { encodeFunctionData } from "viem";

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
  const { sendEvmTransaction } = useSendEvmTransaction();
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

        // x402-express returns an 'accepts' array with payment options
        if (
          !paymentInfo.accepts ||
          !Array.isArray(paymentInfo.accepts) ||
          paymentInfo.accepts.length === 0
        ) {
          throw new Error("No payment options available from server");
        }

        if (!evmAddress) {
          throw new Error("Wallet not connected");
        }

        // Get the first payment option (should be EVM native payment)
        const paymentOption = paymentInfo.accepts[0];
        console.log("[X402] Payment option:", paymentOption);

        if (!paymentOption.payTo || !paymentOption.maxAmountRequired) {
          throw new Error("Invalid payment option from server");
        }

        // Extract payment details from the accepts array
        const to = paymentOption.payTo;
        const value = paymentOption.maxAmountRequired;
        const asset = paymentOption.asset; // USDC token address
        const network = paymentOption.network; // e.g., "base-sepolia"

        // Map network name to chainId for transaction
        const networkToChainId: Record<string, number> = {
          "base-sepolia": 84532,
          base: 8453,
          ethereum: 1,
          sepolia: 11155111,
        };
        const chainId = networkToChainId[network] || 84532;

        console.log("[X402] Payment details:", {
          to,
          value,
          asset,
          network,
          chainId,
          from: evmAddress,
        });

        // Step 3: Send the payment transaction using CDP SDK
        let txHash: string;

        if (asset) {
          // ERC20 token payment (USDC)
          console.log("[X402] Sending USDC token payment...");

          // ERC20 transfer function ABI
          const erc20Abi = [
            {
              name: "transfer",
              type: "function",
              stateMutability: "nonpayable",
              inputs: [
                { name: "to", type: "address" },
                { name: "amount", type: "uint256" },
              ],
              outputs: [{ name: "", type: "bool" }],
            },
          ] as const;

          // Encode the transfer function call
          const data = encodeFunctionData({
            abi: erc20Abi,
            functionName: "transfer",
            args: [to as `0x${string}`, BigInt(value)],
          });

          // Send the transaction using CDP SDK
          const result = await sendEvmTransaction({
            transaction: {
              to: asset,
              data: data,
              value: BigInt(0), // No ETH value for ERC20 transfer
              chainId: chainId,
              type: "eip1559",
            },
            evmAccount: evmAddress as `0x${string}`,
            network: network as any, // Use dynamic network from payment option
          });

          txHash = result.transactionHash;
        } else {
          // Native token payment (ETH)
          console.log("[X402] Sending native token payment...");

          const result = await sendEvmTransaction({
            transaction: {
              to: to,
              value: BigInt(value),
              chainId: chainId,
              type: "eip1559",
            },
            evmAccount: evmAddress as `0x${string}`,
            network: network as any, // Use dynamic network from payment option
          });

          txHash = result.transactionHash;
        }

        console.log("[X402] Payment transaction sent:", txHash);

        // Step 5: Create payment proof header in x402 protocol format
        // The x402 protocol expects a specific structure with x402Version, scheme, and payload
        const paymentProofData = {
          x402Version: 1,
          scheme: "exact",
          payload: {
            transactionHash: txHash,
            network: network, // Use network name (e.g., "base-sepolia") not chainId
          },
        };
        const paymentProofJson = JSON.stringify(paymentProofData);
        const paymentProof = btoa(paymentProofJson); // Base64 encode

        console.log("[X402] Payment proof created:", paymentProofData);
        console.log("[X402] Payment proof (base64):", paymentProof);

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
