"use client";

import Link from "next/link";
import { BrainCircuit } from "lucide-react";
import { WalletButton } from "@/components/WalletButton";

export function Navbar() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-100 border-b border-white/10 bg-black/50 backdrop-blur-md">
      <div className="container mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 text-xl font-bold">
          <div className="p-1.5 rounded-lg bg-linear-to-br from-indigo-500 to-purple-500">
            <BrainCircuit className="w-6 h-6 text-white" />
          </div>
          <span className="bg-clip-text text-transparent bg-linear-to-r from-white to-gray-400">
            DCM
          </span>
        </Link>

        <div className="hidden md:flex items-start w-[80%] ml-5 gap-8 text-sm font-medium text-gray-400">
          <Link href="/" className="hover:text-white transition-colors">
            Home
          </Link>

          <Link
            href="/dashboard"
            className="hover:text-white transition-colors"
          >
            Dashboard
          </Link>
        </div>

        <WalletButton />
      </div>
    </nav>
  );
}
