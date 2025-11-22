"use client";

import { DatasetCard } from "./DatasetCard";
import { Search, SlidersHorizontal } from "lucide-react";

const DATASETS = [
  // ... (Keep your existing data array here)
  {
    title: "Global Financial Markets 2024",
    description:
      "Comprehensive tick-by-tick data for major global indices including S&P 500. Perfect for HFT training.",
    price: "0.5",
    format: "CSV",
    size: "2.4 TB",
    author: "0x1234...5678",
    tags: ["Finance", "Stocks"],
  },
  {
    title: "Autonomous Driving: Urban Scenes",
    description:
      "Lidar and Camera sensor fusion data from diverse urban environments in varying weather.",
    price: "2.0",
    format: "ROS",
    size: "5 TB",
    author: "0x9876...5432",
    tags: ["Robotics", "Vision"],
  },
  {
    title: "Climate Change: Satellite Imagery",
    description:
      "High-resolution satellite imagery of polar ice caps and rainforests over the last decade.",
    price: "0.15",
    format: "TIFF",
    size: "600 GB",
    author: "0x5555...6666",
    tags: ["Climate", "Geo"],
  },
];

export function Marketplace() {
  return (
    <section id="marketplace" className="py-32 relative bg-black">
      <div className="container mx-auto px-6 relative z-10">
        {/* Header + Search Section */}
        <div className="flex flex-col items-center text-center mb-20">
          <h2 className="text-3xl md:text-5xl font-bold mb-4 tracking-tighter text-white">
            Marketplace
          </h2>
          <p className="text-neutral-400 max-w-lg mb-10">
            Discover high-quality, verifiable datasets tailored for AI training.
          </p>

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
          {DATASETS.map((dataset, index) => (
            <DatasetCard key={index} {...dataset} />
          ))}
        </div>
      </div>
    </section>
  );
}
