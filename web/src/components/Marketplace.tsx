"use client";

import { DatasetCard } from "./DatasetCard";
import { Search, SlidersHorizontal } from "lucide-react";
import { useEffect, useState } from "react";

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

export function Marketplace() {
  const [datasets, setDatasets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [eventCount, setEventCount] = useState(0);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        setLoading(true);
        const response = await fetch("/api/events");
        const data = await response.json();

        if (data.success) {
          setEventCount(data.count);
          // Transform events to dataset card format
          const transformedDatasets = data.events.map(
            (event: DatasetEvent) => ({
              title: event.name || "Untitled Dataset",
              description: event.description,
              price: parseInt(event.price_usdc) / 1_000_000, // Convert USDC (6 decimals) to readable format
              format: event.filetype || "Unknown",
              size: "Filecoin",
              author: `${event.pay_address.slice(
                0,
                6
              )}...${event.pay_address.slice(-4)}`,
              tags: ["Dataset", "Verified"],
              txHash: event.tx_hash,
              pieceCid: event.piece_cid,
              payAddress: event.pay_address,
            })
          );
          setDatasets(transformedDatasets);
        } else {
          setError(data.error || "Failed to fetch datasets");
        }
      } catch (err) {
        setError("Failed to connect to marketplace");
        console.error("Error fetching events:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
    // Refresh every 30 seconds
    const interval = setInterval(fetchEvents, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <section id="marketplace" className="py-32 relative bg-black">
      <div className="container mx-auto px-6 relative z-10">
        {/* Header + Search Section */}
        <div className="flex flex-col items-center text-center mb-20">
          <h2 className="text-3xl md:text-5xl font-bold mb-4 tracking-tighter text-white">
            Marketplace
          </h2>
          <p className="text-neutral-400 max-w-lg mb-10">
            Real-time indexed events from the blockchain via SQD
          </p>

          {/* Event Count Badge */}
          {!loading && (
            <div className="mb-6 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
              <span className="text-sm font-mono text-emerald-400">
                {eventCount} {eventCount === 1 ? "event" : "events"} found
              </span>
            </div>
          )}

          {/* Floating Glass Search Bar */}
          <div className="w-full max-w-2xl relative group">
            <div className="absolute -inset-0.5 bg-linear-to-r from-indigo-500/20 to-purple-500/20 rounded-xl opacity-50 blur group-hover:opacity-75 transition duration-500"></div>
            <div className="relative flex items-center bg-[#0A0A0A] rounded-xl border border-white/10 p-2 shadow-2xl">
              <Search className="w-5 h-5 text-neutral-500 ml-3" />
              <input
                type="text"
                placeholder="Search for financial, medical, or geospatial data..."
                className="w-full bg-transparent border-none text-neutral-200 placeholder-neutral-600 focus:ring-0 focus:outline-none px-4 py-2"
              />
              <div className="hidden md:flex gap-2 pr-2">
                <kbd className="hidden sm:inline-block px-2 py-1 text-xs font-mono text-neutral-500 bg-white/5 rounded border border-white/5">
                  ⌘K
                </kbd>
                <button className="p-2 rounded-lg hover:bg-white/5 text-neutral-400 transition-colors">
                  <SlidersHorizontal className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {loading ? (
            // Loading skeletons
            <>
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="p-6 rounded-2xl border border-white/5 bg-white/[0.02] animate-pulse"
                >
                  <div className="h-6 bg-white/5 rounded w-20 mb-4"></div>
                  <div className="h-6 bg-white/5 rounded w-3/4 mb-2"></div>
                  <div className="h-4 bg-white/5 rounded w-full mb-6"></div>
                  <div className="h-4 bg-white/5 rounded w-1/2"></div>
                </div>
              ))}
            </>
          ) : error ? (
            <div className="col-span-full text-center py-12">
              <p className="text-red-400">{error}</p>
            </div>
          ) : datasets.length === 0 ? (
            <div className="col-span-full text-center py-12">
              <p className="text-neutral-400">No datasets available yet</p>
            </div>
          ) : (
            datasets.map((dataset, index) => (
              <DatasetCard key={index} {...dataset} />
            ))
          )}
        </div>
      </div>
    </section>
  );
}
