"use client";

import { useEffect, useState } from "react";
import { ExternalLink, Clock, FileText, Download } from "lucide-react";
import { DownloadDatasetButton } from "./DownloadDatasetButton";
import { type DownloadResult } from "@/hooks/useX402Payment";

interface DownloadEvent {
  block_number: number;
  timestamp: number;
  piece_cid: string;
  name: string;
  description: string;
  filetype: string;
  price_usdc: string;
  pay_address: string; // This is the seller
  tx_hash: string;
  x402_tx_hash: string;
}

export function RecentDownloadsTable() {
  const [downloads, setDownloads] = useState<DownloadEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDownloads = async () => {
      try {
        const response = await fetch("/api/downloads");
        const data = await response.json();

        if (data.success) {
          // Assuming the API returns 'downloads' array
          setDownloads(data.downloads);
        } else {
          if (downloads.length === 0) {
            setError(data.message || "Failed to fetch downloads");
          }
        }
      } catch (err) {
        console.error("Error fetching downloads:", err);
        if (downloads.length === 0) {
          setError("Failed to connect to explorer");
        }
      } finally {
        setLoading(false);
      }
    };

    fetchDownloads();
    const interval = setInterval(fetchDownloads, 30000);
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

  const formatPrice = (priceUsdc: string) => {
    const price = parseFloat(priceUsdc) / 1_000_000;
    return price.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 6,
    });
  };

  const shortenAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const getFormatColor = (format: string) => {
    const formatLower = format.toLowerCase();
    if (formatLower.includes("text"))
      return "bg-blue-500/10 border-blue-500/30 text-blue-400";
    if (formatLower.includes("json"))
      return "bg-purple-500/10 border-purple-500/30 text-purple-400";
    if (formatLower.includes("csv"))
      return "bg-green-500/10 border-green-500/30 text-green-400";
    if (formatLower.includes("image"))
      return "bg-pink-500/10 border-pink-500/30 text-pink-400";
    return "bg-neutral-500/10 border-neutral-500/30 text-neutral-400";
  };

  if (loading && downloads.length === 0) {
    return (
      <div className="w-full p-8 space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-16 bg-white/5 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (error && downloads.length === 0) {
    return (
      <div className="p-8 text-center text-red-400 border border-red-500/20 bg-red-500/10 rounded-lg">
        {error}
      </div>
    );
  }

  return (
    <div className="w-full max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between mb-8 px-2">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">
            Recent Downloads
          </h2>
          <p className="text-neutral-400 text-sm mt-1.5 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
            Live download feed
          </p>
        </div>
      </div>

      <div className="w-full overflow-hidden rounded-2xl border border-white/10 bg-[#0A0A0A]/50 backdrop-blur-xl shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-white/5 bg-white/5">
                <th className="px-6 py-5 font-medium text-neutral-500 text-xs uppercase tracking-wider">
                  Dataset
                </th>
                <th className="px-6 py-5 font-medium text-neutral-500 text-xs uppercase tracking-wider font-mono">
                  Price (USDC)
                </th>
                <th className="px-6 py-5 font-medium text-neutral-500 text-xs uppercase tracking-wider">
                  Format
                </th>
                <th className="px-6 py-5 font-medium text-neutral-500 text-xs uppercase tracking-wider">
                  Time
                </th>
                <th className="px-6 py-5 font-medium text-neutral-500 text-xs uppercase tracking-wider font-mono">
                  Tx Hash
                </th>
                <th className="px-6 py-5 font-medium text-neutral-500 text-xs uppercase tracking-wider text-center">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {downloads.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-16 text-center text-neutral-500"
                  >
                    <div className="flex flex-col items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-neutral-600">
                        <Download className="w-6 h-6" />
                      </div>
                      <p>No downloads found yet</p>
                    </div>
                  </td>
                </tr>
              ) : (
                downloads.map((download) => (
                  <tr
                    key={`${download.tx_hash}-${download.piece_cid}`}
                    className="group hover:bg-white/5 transition-all duration-300"
                  >
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-lg bg-linear-to-br from-blue-500/10 to-blue-600/10 flex items-center justify-center border border-blue-500/20 group-hover:border-blue-500/40 transition-colors">
                          <FileText className="w-5 h-5 text-blue-500" />
                        </div>
                        <div>
                          <div className="font-medium text-neutral-200 group-hover:text-white transition-colors text-base">
                            {download.name}
                          </div>
                          <div className="text-xs text-neutral-500 mt-0.5">
                            Seller: {shortenAddress(download.pay_address)}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5 font-mono text-neutral-200 text-sm font-medium">
                      ${formatPrice(download.price_usdc)}
                    </td>
                    <td className="px-6 py-5">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-mono uppercase tracking-wide border transition-colors ${getFormatColor(
                          download.filetype
                        )}`}
                      >
                        {download.filetype}
                      </span>
                    </td>
                    <td className="px-6 py-5 text-neutral-400 text-sm">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        {formatTimeAgo(download.timestamp)}
                      </div>
                    </td>
                    <td className="px-6 py-5 font-mono text-neutral-400 text-sm">
                      <a
                        href={`https://sepolia.basescan.org/tx/${download.x402_tx_hash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 hover:text-white transition-colors"
                      >
                        {shortenAddress(download.x402_tx_hash)}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center justify-center gap-2">
                        <DownloadDatasetButton
                          pieceCid={download.piece_cid}
                          datasetName={download.name}
                          price={parseFloat(download.price_usdc) / 1_000_000}
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
