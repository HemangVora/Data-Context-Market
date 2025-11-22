"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Database, ExternalLink, Clock, Coins } from "lucide-react";

interface DatasetEvent {
  block_number: number;
  timestamp: number;
  text_id: string;
  description: string;
  price_usdc: string;
  pay_address: string;
  tx_hash: string;
}

export function DatasetEvents() {
  const [events, setEvents] = useState<DatasetEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchEvents() {
      try {
        const response = await fetch("/api/events");
        const data = await response.json();

        if (data.success) {
          setEvents(data.events);
        } else {
          setError(data.message || "Failed to fetch events");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch events");
      } finally {
        setLoading(false);
      }
    }

    fetchEvents();
    // Refresh every 30 seconds
    const interval = setInterval(fetchEvents, 30000);
    return () => clearInterval(interval);
  }, []);

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString();
  };

  const formatPrice = (priceUsdc: string) => {
    // USDC has 6 decimals
    const price = parseFloat(priceUsdc) / 1_000_000;
    return price.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 6,
    });
  };

  const shortenAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  if (loading) {
    return (
      <section className="relative w-full py-20 bg-black">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 text-neutral-400">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-500"></div>
              Loading events...
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="relative w-full py-20 bg-black">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400">
              <span>⚠️</span>
              <span>{error}</span>
            </div>
            <p className="mt-4 text-sm text-neutral-500">
              Make sure ClickHouse is running and the indexer has processed
              events.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="relative w-full py-20 bg-black">
      <div className="max-w-7xl mx-auto px-4">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-medium mb-4">
            <Database className="w-3 h-3" />
            <span>Indexed Events</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-b from-white to-neutral-400">
            Recent Dataset Uploads
          </h2>
          <p className="mt-4 text-neutral-400 max-w-2xl mx-auto">
            Real-time indexed events from the blockchain via SQD
          </p>
          <p className="mt-2 text-sm text-neutral-500">
            {events.length} {events.length === 1 ? "event" : "events"} found
          </p>
        </motion.div>

        {/* Events List */}
        {events.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center py-20"
          >
            <Database className="w-16 h-16 mx-auto text-neutral-700 mb-4" />
            <p className="text-neutral-400 text-lg">No events found yet</p>
            <p className="text-neutral-600 text-sm mt-2">
              Upload a dataset to see it appear here
            </p>
          </motion.div>
        ) : (
          <div className="grid gap-4 md:gap-6">
            {events.map((event, index) => (
              <motion.div
                key={`${event.tx_hash}-${event.text_id}`}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.05, duration: 0.4 }}
                className="group relative rounded-2xl border border-white/5 bg-white/[0.02] p-6 hover:bg-white/[0.04] transition-all"
              >
                {/* Event Content */}
                <div className="flex flex-col md:flex-row md:items-start gap-4">
                  {/* Left: Icon */}
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 rounded-lg border border-white/10 bg-indigo-500/10 flex items-center justify-center">
                      <Database className="w-6 h-6 text-indigo-400" />
                    </div>
                  </div>

                  {/* Middle: Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <div>
                        <h3 className="text-lg font-semibold text-white mb-1">
                          {event.text_id}
                        </h3>
                        <p className="text-neutral-400 text-sm leading-relaxed">
                          {event.description}
                        </p>
                      </div>
                    </div>

                    {/* Metadata */}
                    <div className="flex flex-wrap items-center gap-4 mt-4 text-xs text-neutral-500">
                      <div className="flex items-center gap-1.5">
                        <Coins className="w-3.5 h-3.5 text-green-400" />
                        <span className="text-green-400 font-medium">
                          ${formatPrice(event.price_usdc)} USDC
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{formatTimestamp(event.timestamp)}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-neutral-600">Block:</span>
                        <span className="font-mono">{event.block_number}</span>
                      </div>
                    </div>

                    {/* Transaction & Address */}
                    <div className="flex flex-wrap items-center gap-4 mt-3 text-xs">
                      <a
                        href={`https://sepolia.etherscan.io/tx/${event.tx_hash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-indigo-400 hover:text-indigo-300 transition-colors"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span className="font-mono">
                          {shortenAddress(event.tx_hash)}
                        </span>
                      </a>
                      <div className="text-neutral-600">
                        Pay:{" "}
                        <span className="text-neutral-500 font-mono">
                          {shortenAddress(event.pay_address)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
