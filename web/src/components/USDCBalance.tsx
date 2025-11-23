"use client";

import { useEvmAddress, useIsSignedIn } from "@coinbase/cdp-hooks";
import { DollarSign, ExternalLink, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { createPublicClient, http, formatUnits } from "viem";
import { baseSepolia } from "viem/chains";

const USDC_ADDRESS = "0x036CbD53842c5426634e7929541eC2318f3dCF7e"; // Base Sepolia USDC

const USDC_ABI = [
  {
    constant: true,
    inputs: [{ name: "_owner", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "balance", type: "uint256" }],
    type: "function",
  },
] as const;

export function USDCBalance() {
  const { isSignedIn } = useIsSignedIn();
  const { evmAddress } = useEvmAddress();
  const [balance, setBalance] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isSignedIn || !evmAddress) {
      setBalance(null);
      return;
    }

    const fetchBalance = async () => {
      try {
        setLoading(true);

        const client = createPublicClient({
          chain: baseSepolia,
          transport: http(),
        });

        const balanceResult = await client.readContract({
          address: USDC_ADDRESS,
          abi: USDC_ABI,
          functionName: "balanceOf",
          args: [evmAddress as `0x${string}`],
        });

        // USDC has 6 decimals
        const formattedBalance = formatUnits(balanceResult as bigint, 6);
        setBalance(formattedBalance);
      } catch (error) {
        console.error("Error fetching USDC balance:", error);
        setBalance("0");
      } finally {
        setLoading(false);
      }
    };

    fetchBalance();

    // Refresh balance every 10 seconds
    const interval = setInterval(fetchBalance, 10000);
    return () => clearInterval(interval);
  }, [isSignedIn, evmAddress]);

  if (!isSignedIn || !evmAddress) {
    return null;
  }

  const explorerUrl = `https://sepolia.basescan.org/address/${evmAddress}`;

  return (
    <a
      href={explorerUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 transition-all group"
      title="View on BaseScan"
    >
      <div className="flex items-center gap-1.5">
        <DollarSign className="w-4 h-4 text-emerald-400" />
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin text-neutral-400" />
        ) : (
          <span className="text-sm font-mono font-medium text-white">
            {balance
              ? parseFloat(balance).toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })
              : "0.00"}
          </span>
        )}
        <span className="text-xs text-neutral-400">USDC</span>
      </div>
      <ExternalLink className="w-3 h-3 text-neutral-500 group-hover:text-neutral-300 transition-colors" />
    </a>
  );
}
