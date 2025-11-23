"use client";

import { useEffect, useState, useRef } from "react";
import { ExternalLink, Calendar, ShieldCheck, Server } from "lucide-react";
import { DownloadDatasetButton } from "./DownloadDatasetButton";
import { type DownloadResult } from "@/hooks/useX402Payment";
import { Area, AreaChart, ResponsiveContainer } from "recharts";

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

interface Dataset {
  title: string;
  description: string;
  price: number;
  format: string;
  size: string;
  author: string;
  tags: string[];
  txHash: string;
  pieceCid: string;
  payAddress: string;
  timestamp: number;
  activity: { value: number }[];
}

// Mock function to generate random sparkline data
// We'll generate this once per dataset to keep it stable
const generateSparkline = () => {
  return Array.from({ length: 20 }, () => ({
    value: Math.floor(Math.random() * 100) + 20,
  }));
};

export function ExplorerTable() {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Keep track of the latest tx hash to detect changes
  const latestTxHashRef = useRef<string | null>(null);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        // Only set loading true on the very first load
        // Subsequent background refetches won't trigger the loading skeleton

        const response = await fetch("/api/events");
        const data = await response.json();

        if (data.success) {
          const events = data.events as DatasetEvent[];

          // Check if we need to update
          // We assume events are sorted by latest first or we can check the list
          const newLatestHash = events.length > 0 ? events[0].tx_hash : "";

          // If we have data and the top event is the same, and the count is the same,
          // we can likely skip updating to prevent UI jitter.
          // A more robust check would be comparing all IDs.

          setDatasets((prevDatasets) => {
            // Create a map of existing datasets by txHash to preserve their state (like activity data)
            const existingMap = new Map(prevDatasets.map((d) => [d.txHash, d]));

            const transformedDatasets = events.map((event) => {
              const existing = existingMap.get(event.tx_hash);
              if (existing) {
                return existing; // Return exact same object reference to prevent re-render of that row
              }

              // New dataset
              return {
                title: event.name || "Untitled Dataset",
                description: event.description,
                price: parseInt(event.price_usdc) / 1_000_000,
                format: event.filetype || "Unknown",
                size: "Filecoin",
                author: event.pay_address,
                tags: ["Dataset", "Verified"],
                txHash: event.tx_hash,
                pieceCid: event.piece_cid,
                payAddress: event.pay_address,
                timestamp: event.timestamp,
                activity: generateSparkline(), // Only generate for new items
              };
            });

            // If the length is different or the first item is different, update
            // Or if any item changed (which we handled by returning existing objects)

            // Simple check: if every item in new array is referentially equal to old array item at same index
            if (
              prevDatasets.length === transformedDatasets.length &&
              prevDatasets.every((d, i) => d === transformedDatasets[i])
            ) {
              return prevDatasets;
            }

            return transformedDatasets;
          });
        } else {
          // Only set error if we don't have data yet
          setDatasets((prev) => {
            if (prev.length === 0) {
              setError(data.error || "Failed to fetch datasets");
            }
            return prev;
          });
        }
      } catch (err) {
        console.error("Error fetching events:", err);
        setDatasets((prev) => {
          if (prev.length === 0) {
            setError("Failed to connect to explorer");
          }
          return prev;
        });
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
    const interval = setInterval(fetchEvents, 30000);
    return () => clearInterval(interval);
  }, []);

  const handlePurchaseSuccess = (result: DownloadResult) => {
    console.log("Dataset purchased successfully!", result);
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

  if (loading) {
    return (
      <div className="w-full p-8 space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-16 bg-white/5 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (error && datasets.length === 0) {
    return (
      <div className="p-8 text-center text-red-400 border border-red-500/20 bg-red-500/10 rounded-lg">
        {error}
      </div>
    );
  }

  return (
    <div className="w-full max-w-[1400px] mx-auto">
      {/* Header Actions */}
      <div className="flex items-center justify-between mb-8 px-2">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">
            Top Datasets
          </h2>
          <p className="text-neutral-400 text-sm mt-1.5 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Live marketplace activity
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-neutral-400 text-sm hover:bg-white/10 transition-all hover:border-white/20 hover:text-white">
            <Calendar className="w-4 h-4" />
            <span>Last 24h</span>
          </button>
        </div>
      </div>

      {/* Table Container */}
      <div className="w-full overflow-hidden rounded-2xl border border-white/10 bg-[#0A0A0A]/50 backdrop-blur-xl shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-white/5 bg-white/5">
                <th className="px-6 py-5 font-medium text-neutral-500 text-xs uppercase tracking-wider">
                  Dataset
                </th>
                <th className="px-6 py-5 font-medium text-neutral-500 text-xs uppercase tracking-wider">
                  Activity
                </th>
                <th className="px-6 py-5 font-medium text-neutral-500 text-xs uppercase tracking-wider font-mono">
                  Storage
                </th>
                <th className="px-6 py-5 font-medium text-neutral-500 text-xs uppercase tracking-wider font-mono">
                  Price(USDC)
                </th>
                <th className="px-6 py-5 font-medium text-neutral-500 text-xs uppercase tracking-wider">
                  Format
                </th>
                <th className="px-6 py-5 font-medium text-neutral-500 text-xs uppercase tracking-wider">
                  Listed
                </th>

                <th className="px-6 py-5 font-medium text-neutral-500 text-xs uppercase tracking-wider text-center">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {datasets.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-6 py-16 text-center text-neutral-500"
                  >
                    <div className="flex flex-col items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-neutral-600">
                        <Server className="w-6 h-6" />
                      </div>
                      <p>No datasets found yet</p>
                    </div>
                  </td>
                </tr>
              ) : (
                datasets.map((dataset, index) => (
                  <tr
                    key={dataset.txHash}
                    className="group hover:bg-white/5 transition-all duration-300"
                  >
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-lg bg-linear-to-br from-orange-500/10 to-orange-600/10 flex items-center justify-center border border-orange-500/20 group-hover:border-orange-500/40 transition-colors">
                          <Server className="w-5 h-5 text-orange-500" />
                        </div>
                        <div>
                          <div className="font-medium text-neutral-200 group-hover:text-white transition-colors flex items-center gap-2 text-base">
                            {dataset.title}
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                          </div>
                          <div className="text-xs text-neutral-500 font-mono mt-0.5 flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-neutral-700" />
                            {dataset.payAddress.slice(0, 6)}...
                            {dataset.payAddress.slice(-4)}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5 w-40">
                      <div className="h-10 w-32 opacity-60 group-hover:opacity-100 transition-opacity">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={dataset.activity}>
                            <defs>
                              <linearGradient
                                id={`gradient-${dataset.txHash}`}
                                x1="0"
                                y1="0"
                                x2="0"
                                y2="1"
                              >
                                <stop
                                  offset="5%"
                                  stopColor="#3b82f6"
                                  stopOpacity={0.3}
                                />
                                <stop
                                  offset="95%"
                                  stopColor="#3b82f6"
                                  stopOpacity={0}
                                />
                              </linearGradient>
                            </defs>
                            <Area
                              type="monotone"
                              dataKey="value"
                              stroke="#3b82f6"
                              fill={`url(#gradient-${dataset.txHash})`}
                              strokeWidth={1.5}
                              isAnimationActive={false}
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </td>
                    <td className="px-6 py-5 font-mono text-neutral-400 text-sm">
                      {dataset.size}
                    </td>
                    <td className="px-6 py-5 font-mono text-neutral-200 text-sm font-medium">
                      ${dataset.price}
                    </td>
                    <td className="px-6 py-5">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-mono uppercase tracking-wide border transition-colors ${getFormatColor(
                          dataset.format
                        )}`}
                      >
                        {dataset.format}
                      </span>
                    </td>
                    <td className="px-6 py-5 text-neutral-400 text-sm">
                      {formatTimeAgo(dataset.timestamp)}
                    </td>

                    <td className="px-6 py-5">
                      <div className="flex items-center justify-center gap-2">
                        {dataset.txHash && (
                          <a
                            href={`https://sepolia.etherscan.io/tx/${dataset.txHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 rounded-lg hover:bg-white/10 text-neutral-500 hover:text-white transition-all"
                            title="View Transaction"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        )}
                        <DownloadDatasetButton
                          pieceCid={dataset.pieceCid}
                          datasetName={dataset.title}
                          price={dataset.price}
                          onDownloadSuccess={handlePurchaseSuccess}
                        />
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
