"use client";

import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { FileUpload } from "@/components/FileUpload";
import { UserDashboard } from "@/components/UserDashboard";

export default function DashboardPage() {
  return (
    <main className="min-h-screen bg-black text-white selection:bg-indigo-500/30">
      <Navbar />

      <div className="pt-24 pb-32 px-4">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="text-center mb-16">
            <h1 className="text-5xl md:text-6xl font-bold tracking-tight bg-clip-text text-transparent bg-linear-to-b from-white to-neutral-400 mb-4">
              Your Dashboard
            </h1>
            <p className="text-lg text-neutral-400 max-w-2xl mx-auto">
              Upload and manage your datasets on the decentralized marketplace
            </p>
          </div>

          {/* Upload Section */}
          <div className="mb-16">
            <FileUpload />
          </div>

          {/* User's Datasets */}
          <div>
            <UserDashboard />
          </div>
        </div>
      </div>

      <Footer />
    </main>
  );
}
