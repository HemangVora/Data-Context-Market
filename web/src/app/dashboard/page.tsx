"use client";

import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { FileUpload } from "@/components/FileUpload";
import { UserDashboard } from "@/components/UserDashboard";

export default function DashboardPage() {
  return (
    <main className="min-h-screen bg-[#020408] text-white selection:bg-indigo-500/30">
      <Navbar />

      <div className="container mx-auto px-4 py-8 max-w-7xl mt-16">
        {/* Compact Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-white mb-1">
            Dashboard
          </h1>
          <p className="text-sm text-neutral-400">
            Upload and manage your datasets
          </p>
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Upload Section - Takes 1 column */}
          <div className="lg:col-span-1">
            <FileUpload />
          </div>

          {/* User's Datasets - Takes 2 columns */}
          <div className="lg:col-span-2">
            <UserDashboard />
          </div>
        </div>
      </div>

      <Footer />
    </main>
  );
}
