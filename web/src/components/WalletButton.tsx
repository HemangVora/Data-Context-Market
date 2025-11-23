"use client";

import { useIsSignedIn, useEvmAddress, useSignOut } from "@coinbase/cdp-hooks";
import { AuthButton } from "@coinbase/cdp-react/components/AuthButton";
import { Wallet, LogOut } from "lucide-react";
import { useState } from "react";

export function WalletButton() {
  const { isSignedIn } = useIsSignedIn();
  const { evmAddress } = useEvmAddress();
  const { signOut } = useSignOut();
  const [showDropdown, setShowDropdown] = useState(false);

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      setShowDropdown(false);
    } catch (error) {
      console.error("Sign out failed:", error);
    }
  };

  if (isSignedIn && evmAddress) {
    return (
      <div className="relative">
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          className="flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 transition-all text-sm font-medium"
        >
          <Wallet className="w-4 h-4 text-indigo-400" />
          <span className="text-indigo-300">{formatAddress(evmAddress)}</span>
        </button>

        {showDropdown && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-40"
              onClick={() => setShowDropdown(false)}
            />
            {/* Dropdown */}
            <div className="absolute right-0 mt-2 w-64 rounded-lg bg-gray-900 border border-white/10 shadow-xl z-50">
              <div className="p-4 border-b border-white/10">
                <p className="text-xs text-gray-400 mb-1">Connected Wallet</p>
                <p className="text-sm font-mono text-white break-all">
                  {evmAddress}
                </p>
              </div>
              <div className="p-2">
                <button
                  onClick={handleSignOut}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-md hover:bg-white/5 transition-colors text-sm text-red-400"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 relative z-[9999]">
      <div className="[&>button]:flex [&>button]:items-center [&>button]:gap-2 [&>button]:px-4 [&>button]:py-2 [&>button]:rounded-full [&>button]:bg-indigo-500/10 [&>button]:hover:bg-indigo-500/20 [&>button]:border [&>button]:border-indigo-500/30 [&>button]:transition-all [&>button]:text-sm [&>button]:font-medium [&>button]:text-indigo-300">
        <AuthButton />
      </div>
    </div>
  );
}
