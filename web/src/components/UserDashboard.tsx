"use client";

import { useState, useEffect } from "react";
import { useEvmAddress, useIsSignedIn } from "@coinbase/cdp-hooks";
import {
  FileText,
  Download,
  DollarSign,
  Calendar,
  Loader2,
  Package,
  Server,
  ShieldCheck,
  ExternalLink,
} from "lucide-react";

interface DatasetEvent {
  block_number: number;
  timestamp: number;
  piece_cid: string;
  name: string;
  description: string;
  filetype: string;
  price_usdc: string;
  pay_address: string;
  tx_hash: string;
}

export function UserDashboard() {
  const { isSignedIn } = useIsSignedIn();
  const { evmAddress } = useEvmAddress();
  const [userDatasets, setUserDatasets] = useState<DatasetEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isSignedIn || !evmAddress) {
      setLoading(false);
      return;
    }

    const fetchUserDatasets = async () => {
      try {
        setLoading(true);
        const response = await fetch("/api/events");
        const data = await response.json();

        if (data.success) {
          // Filter datasets by current user's address
          const filtered = data.events.filter(
            (event: DatasetEvent) =>
              event.pay_address.toLowerCase() === evmAddress.toLowerCase()
          );
          setUserDatasets(filtered);
        } else {
          setError(data.error || "Failed to fetch datasets");
        }
      } catch (err) {
        console.error("Error fetching user datasets:", err);
        setError("Failed to load your datasets");
      } finally {
        setLoading(false);
      }
    };

    fetchUserDatasets();

    // Refresh every 30 seconds
    const interval = setInterval(fetchUserDatasets, 30000);
    return () => clearInterval(interval);
  }, [isSignedIn, evmAddress]);

  const formatPrice = (priceUsdc: string) => {
    const price = parseFloat(priceUsdc) / 1_000_000;
    return price.toFixed(2);
  };

  const formatTimeAgo = (timestamp: number) => {
    const seconds = Math.floor(Date.now() / 1000 - timestamp);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  const getFormatColor = (format: string) => {
    const formatLower = format.toLowerCase();
    if (formatLower.includes("text")) {
      return "bg-blue-500/10 border-blue-500/30 text-blue-400";
    }
    if (formatLower.includes("json")) {
      return "bg-purple-500/10 border-purple-500/30 text-purple-400";
    }
    if (formatLower.includes("csv")) {
      return "bg-green-500/10 border-green-500/30 text-green-400";
    }
    if (formatLower.includes("octet") || formatLower.includes("binary")) {
      return "bg-orange-500/10 border-orange-500/30 text-orange-400";
    }
    if (formatLower.includes("image")) {
      return "bg-pink-500/10 border-pink-500/30 text-pink-400";
    }
    if (formatLower.includes("pdf")) {
      return "bg-red-500/10 border-red-500/30 text-red-400";
    }
    return "bg-neutral-500/10 border-neutral-500/30 text-neutral-400";
  };

  if (!isSignedIn) {
    return (
      <div className="w-full">
        <div className="w-full overflow-hidden rounded-2xl border border-white/10 bg-[#0A0A0A]/50 backdrop-blur-xl shadow-2xl p-8">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-indigo-500/10 border border-indigo-500/20 mb-3">
              <Package className="w-6 h-6 text-indigo-400" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Connect Wallet</h3>
            <p className="text-neutral-400 text-sm">
              Connect to view your datasets
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="w-full">
        <div className="flex items-center justify-between mb-4 px-2">
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">
              My Datasets
            </h2>
            <p className="text-neutral-400 text-xs mt-1 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Loading...
            </p>
          </div>
        </div>
        <div className="w-full p-6 space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-12 bg-white/5 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full">
        <div className="p-6 text-center text-red-400 border border-red-500/20 bg-red-500/10 rounded-lg text-sm">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 px-2">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">
            My Datasets
          </h2>
          <p className="text-neutral-400 text-xs mt-1 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            {userDatasets.length} dataset{userDatasets.length !== 1 ? "s" : ""}{" "}
            uploaded
          </p>
        </div>
      </div>

      {/* Table Container */}
      <div className="w-full overflow-hidden rounded-2xl border border-white/10 bg-[#0A0A0A]/50 backdrop-blur-xl shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-white/5 bg-white/5">
                <th className="px-4 py-3 font-medium text-neutral-500 text-xs uppercase tracking-wider">
                  Dataset
                </th>
                <th className="px-4 py-3 font-medium text-neutral-500 text-xs uppercase tracking-wider font-mono">
                  Price
                </th>
                <th className="px-4 py-3 font-medium text-neutral-500 text-xs uppercase tracking-wider">
                  Format
                </th>
                <th className="px-4 py-3 font-medium text-neutral-500 text-xs uppercase tracking-wider">
                  Listed
                </th>
                <th className="px-4 py-3 font-medium text-neutral-500 text-xs uppercase tracking-wider text-center">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {userDatasets.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-12 text-center text-neutral-500"
                  >
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-neutral-600">
                        <Package className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-base font-semibold mb-1 text-white">
                          No Datasets Yet
                        </h3>
                        <p className="text-sm">Upload your first dataset!</p>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                userDatasets.map((dataset) => (
                  <tr
                    key={dataset.tx_hash}
                    className="group hover:bg-white/5 transition-all duration-300"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-linear-to-br from-indigo-500/10 to-indigo-600/10 flex items-center justify-center border border-indigo-500/20 group-hover:border-indigo-500/40 transition-colors">
                          <Server className="w-4 h-4 text-indigo-500" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-neutral-200 group-hover:text-white transition-colors flex items-center gap-2 text-sm truncate">
                            {dataset.name}
                            <ShieldCheck className="w-3 h-3 text-emerald-500 shrink-0" />
                          </div>
                          <div className="text-xs text-neutral-500 mt-0.5 line-clamp-1">
                            {dataset.description}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-neutral-200 text-sm font-medium">
                      ${formatPrice(dataset.price_usdc)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-mono uppercase tracking-wide border transition-colors ${getFormatColor(
                          dataset.filetype
                        )}`}
                      >
                        {dataset.filetype}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-neutral-400 text-xs">
                      {formatTimeAgo(dataset.timestamp)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <a
                          href={`https://sepolia.etherscan.io/tx/${dataset.tx_hash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 rounded-lg hover:bg-white/10 text-neutral-500 hover:text-white transition-all"
                          title="View Transaction"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(dataset.piece_cid);
                          }}
                          className="p-1.5 rounded-lg hover:bg-white/10 text-neutral-500 hover:text-white transition-all"
                          title="Copy CID"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
