"use client";

import { useIsSignedIn, useEvmAddress } from "@coinbase/cdp-hooks";
import { SendEvmTransactionButton } from "@coinbase/cdp-react";
import { ShoppingCart, Wallet } from "lucide-react";
import { useState } from "react";

interface PurchaseDatasetButtonProps {
  datasetName: string;
  priceUSDC: string;
  payAddress: string;
  onPurchaseSuccess?: (txHash: string) => void;
}

export function PurchaseDatasetButton({
  datasetName,
  priceUSDC,
  payAddress,
  onPurchaseSuccess,
}: PurchaseDatasetButtonProps) {
  const { isSignedIn } = useIsSignedIn();
  const { evmAddress } = useEvmAddress();
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);

  // Convert USDC price to wei (assuming 6 decimals for USDC)
  const priceInWei = BigInt(priceUSDC) * BigInt(10 ** 6);

  // Ensure payAddress is a valid hex address
  const toAddress = (
    payAddress.startsWith("0x") ? payAddress : `0x${payAddress}`
  ) as `0x${string}`;

  if (!isSignedIn) {
    return (
      <div>
        <button
          onClick={() => setShowAuthPrompt(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 transition-all text-sm font-medium text-indigo-300"
        >
          <Wallet className="w-4 h-4" />
          <span>Connect to Purchase</span>
        </button>

        {showAuthPrompt && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-gray-900 border border-white/10 rounded-2xl p-6 max-w-md w-full">
              <h3 className="text-xl font-bold mb-2">Connect Your Wallet</h3>
              <p className="text-gray-400 mb-6">
                Connect your wallet to purchase "{datasetName}"
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowAuthPrompt(false)}
                  className="flex-1 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setShowAuthPrompt(false);
                    // Trigger wallet connection - user should click the nav button
                  }}
                  className="flex-1 px-4 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-600 transition-colors"
                >
                  Connect Wallet
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (!evmAddress) {
    return (
      <button
        disabled
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-500 cursor-not-allowed text-sm font-medium"
      >
        <ShoppingCart className="w-4 h-4" />
        <span>Loading wallet...</span>
      </button>
    );
  }

  return (
    <SendEvmTransactionButton
      account={evmAddress}
      network="base-sepolia" // Base Sepolia testnet for x402
      transaction={{
        to: toAddress,
        value: priceInWei,
        chainId: 84532, // Base Sepolia
        type: "eip1559",
      }}
      onSuccess={(hash) => {
        console.log("Purchase successful! Transaction:", hash);
        if (onPurchaseSuccess) {
          onPurchaseSuccess(hash);
        }
      }}
      onError={(error) => {
        console.error("Purchase failed:", error);
        alert(`Purchase failed: ${error.message}`);
      }}
      pendingLabel="Processing..."
      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-600 transition-all text-sm font-medium"
    >
      <ShoppingCart className="w-4 h-4" />
      <span>Purchase ({priceUSDC} USDC)</span>
    </SendEvmTransactionButton>
  );
}
