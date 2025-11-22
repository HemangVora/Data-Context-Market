"use client";

import Link from "next/link";
import { BrainCircuit, Wallet } from "lucide-react";

export function Navbar() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/10 bg-black/50 backdrop-blur-md">
      <div className="container mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 text-xl font-bold">
          <div className="p-1.5 rounded-lg bg-linear-to-br from-indigo-500 to-purple-500">
            <BrainCircuit className="w-6 h-6 text-white" />
          </div>
          <span className="bg-clip-text text-transparent bg-linear-to-r from-white to-gray-400">
            DataNexus
          </span>
        </Link>

        <div className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-400">
          <Link
            href="#marketplace"
            className="hover:text-white transition-colors"
          >
            Marketplace
          </Link>
          <Link href="#publish" className="hover:text-white transition-colors">
            Publish
          </Link>
          <Link href="#agents" className="hover:text-white transition-colors">
            For Agents
          </Link>
        </div>

        <button className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 transition-all text-sm font-medium">
          <Wallet className="w-4 h-4" />
          <span>Connect Wallet</span>
        </button>
      </div>
    </nav>
  );
}
