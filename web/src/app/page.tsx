import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { ExplorerTable } from "@/components/ExplorerTable";
import { RecentDownloadsTable } from "@/components/RecentDownloadsTable";
import { StatsOverview } from "@/components/StatsOverview";
import { Search } from "lucide-react";

export default function Home() {
  return (
    <main className="min-h-screen bg-[#020408] text-white selection:bg-indigo-500/30 font-sans">
      <Navbar />

      <div className="container mx-auto px-4 py-12 max-w-7xl">
        {/* Hero / Search Section */}
        <div className="flex flex-col items-center text-center mb-6 mt-8"></div>

        {/* Stats Overview */}
        <StatsOverview />

        {/* Top Datasets Table */}
        <div className="space-y-6 mb-12">
          <ExplorerTable />
        </div>

        {/* Recent Downloads Table */}
        <div className="space-y-6">
          <RecentDownloadsTable />
        </div>
      </div>

      <Footer />
    </main>
  );
}
