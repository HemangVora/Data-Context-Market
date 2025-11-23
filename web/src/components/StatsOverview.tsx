"use client";

import {
  Calendar,
  Database,
  User,
  Bot,
  Clock,
  TrendingUp,
  TrendingDown,
  Activity,
  Trophy,
  Activity as ActivityIcon,
  Download,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

// Types
interface ActivityItem {
  id: string;
  title: string;
  type: "ai" | "human" | "download";
  timestamp: string;
  value: string;
  isPositive?: boolean;
  eventType?: "upload" | "download";
}

interface TopContributor {
  id: string;
  name: string;
  address: string;
  volume: string;
  items: number;
  rank: number;
}

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

interface DownloadEvent {
  block_number: number;
  timestamp: number;
  piece_cid: string;
  name: string;
  description: string;
  filetype: string;
  price_usdc: string;
  pay_address: string;
  tx_hash: string;
  x402_tx_hash: string;
}

// Mock Data
const MOCK_ACTIVITIES: ActivityItem[] = [
  {
    id: "1",
    title: "Healthcare Analysis Dataset 2024",
    type: "ai",
    timestamp: "2m ago",
    value: "$45.00",
    isPositive: true,
  },
  {
    id: "2",
    title: "Global Temperature Trends",
    type: "human",
    timestamp: "15m ago",
    value: "Free",
    isPositive: true,
  },
  {
    id: "3",
    title: "Crypto Market Sentiment Q3",
    type: "ai",
    timestamp: "42m ago",
    value: "$120.00",
    isPositive: true,
  },
  {
    id: "4",
    title: "Urban Traffic Patterns NYC",
    type: "human",
    timestamp: "1h ago",
    value: "$15.50",
    isPositive: true,
  },
  {
    id: "5",
    title: "Solar Flare Predictions",
    type: "ai",
    timestamp: "2h ago",
    value: "$80.00",
    isPositive: true,
  },
  {
    id: "6",
    title: "Genome Sequencing Batch A",
    type: "ai",
    timestamp: "3h ago",
    value: "$250.00",
    isPositive: true,
  },
];

const MOCK_CONTRIBUTORS: TopContributor[] = [
  {
    id: "1",
    name: "DataLab_AI",
    address: "0x71...39A2",
    volume: "$12,450",
    items: 145,
    rank: 1,
  },
  {
    id: "2",
    name: "Research_DAO",
    address: "0xB4...91C2",
    volume: "$8,230",
    items: 89,
    rank: 2,
  },
  {
    id: "3",
    name: "OpenMetrics",
    address: "0x12...88D1",
    volume: "$6,120",
    items: 64,
    rank: 3,
  },
  {
    id: "4",
    name: "Quantum_Sense",
    address: "0x99...11F4",
    volume: "$4,500",
    items: 32,
    rank: 4,
  },
  {
    id: "5",
    name: "Civic_Data",
    address: "0x33...77E9",
    volume: "$3,100",
    items: 28,
    rank: 5,
  },
];

const CHART_DATA = [
  { date: "30.10", value1: 4000, value2: 2400, value3: 2400 },
  { date: "31.10", value1: 3000, value2: 1398, value3: 2210 },
  { date: "01.11", value1: 2000, value2: 9800, value3: 2290 },
  { date: "02.11", value1: 2780, value2: 3908, value3: 2000 },
  { date: "03.11", value1: 1890, value2: 4800, value3: 2181 },
  { date: "04.11", value1: 2390, value2: 3800, value3: 2500 },
  { date: "05.11", value1: 3490, value2: 4300, value3: 2100 },
];

// CountUp Component
function CountUp({
  end,
  duration = 2000,
  prefix = "",
  suffix = "",
  decimals = 0,
}: {
  end: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
}) {
  const [count, setCount] = useState(0);
  const countRef = useRef(0);
  const startTimeRef = useRef<number | null>(null);

  useEffect(() => {
    const animate = (timestamp: number) => {
      if (!startTimeRef.current) startTimeRef.current = timestamp;
      const progress = timestamp - startTimeRef.current;
      const percentage = Math.min(progress / duration, 1);

      // EaseOutQuart
      const ease = 1 - Math.pow(1 - percentage, 4);

      const currentCount = end * ease;
      setCount(currentCount);

      if (percentage < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [end, duration]);

  return (
    <span>
      {prefix}
      {count.toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}
      {suffix}
    </span>
  );
}

export function StatsOverview() {
  const [marketTab, setMarketTab] = useState<"activity" | "contributors">(
    "activity"
  );
  const [loading, setLoading] = useState(true);
  const [activities, setActivities] = useState<ActivityItem[]>([]);

  useEffect(() => {
    // Fetch real data from API endpoints
    const fetchActivities = async () => {
      try {
        const [eventsRes, downloadsRes] = await Promise.all([
          fetch("/api/events"),
          fetch("/api/downloads"),
        ]);

        const eventsData = await eventsRes.json();
        const downloadsData = await downloadsRes.json();

        const combinedActivities: ActivityItem[] = [];

        // Process events (uploads)
        if (eventsData.success && eventsData.events) {
          eventsData.events.forEach((event: DatasetEvent) => {
            combinedActivities.push({
              id: `event-${event.tx_hash}`,
              title: event.name,
              type: "ai", // You can determine this based on some logic if needed
              timestamp: formatTimestamp(event.timestamp),
              value:
                event.price_usdc === "0"
                  ? "Free"
                  : `$${(parseFloat(event.price_usdc) / 1e6).toFixed(2)}`,
              isPositive: true,
              eventType: "upload",
            });
          });
        }

        // Process downloads
        if (downloadsData.success && downloadsData.downloads) {
          downloadsData.downloads.forEach((download: DownloadEvent) => {
            combinedActivities.push({
              id: `download-${download.x402_tx_hash || download.tx_hash}`,
              title: download.name,
              type: "download",
              timestamp: formatTimestamp(download.timestamp),
              value:
                download.price_usdc === "0"
                  ? "Free"
                  : `$${(parseFloat(download.price_usdc) / 1e6).toFixed(2)}`,
              isPositive: true,
              eventType: "download",
            });
          });
        }

        // Sort by timestamp (newest first) - assuming timestamp is in seconds
        combinedActivities.sort((a, b) => {
          // Extract the actual timestamp for sorting
          return 0; // We'll keep the order from API which is already sorted
        });

        setActivities(combinedActivities.slice(0, 20)); // Limit to 20 most recent
        setLoading(false);
      } catch (error) {
        console.error("Error fetching activities:", error);
        setActivities(MOCK_ACTIVITIES); // Fallback to mock data
        setLoading(false);
      }
    };

    fetchActivities();
  }, []);

  // Helper function to format timestamp
  const formatTimestamp = (timestamp: number): string => {
    const now = Date.now() / 1000; // Convert to seconds
    const diff = now - timestamp;

    if (diff < 60) {
      return "Just now";
    } else if (diff < 3600) {
      const mins = Math.floor(diff / 60);
      return `${mins}m ago`;
    } else if (diff < 86400) {
      const hours = Math.floor(diff / 3600);
      return `${hours}h ago`;
    } else {
      const days = Math.floor(diff / 86400);
      return `${days}d ago`;
    }
  };

  if (loading) {
    return (
      <div className="mb-12 space-y-6">
        {/* Top Row - Cards Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="bg-neutral-900/50 border border-white/5 rounded-2xl p-6 h-[200px] flex flex-col justify-between animate-pulse"
            >
              <div className="flex justify-between">
                <div className="space-y-2">
                  <div className="h-4 w-24 bg-white/10 rounded" />
                  <div className="h-8 w-32 bg-white/10 rounded" />
                </div>
                <div className="w-10 h-10 rounded-full bg-white/10" />
              </div>
              <div className="flex gap-4">
                <div className="h-6 w-20 bg-white/10 rounded" />
                <div className="h-6 w-20 bg-white/10 rounded" />
              </div>
            </div>
          ))}
        </div>

        {/* Bottom Row - Table & Chart Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Middle Column Skeleton (Merged Table) */}
          <div className="lg:col-span-2 bg-neutral-900/50 border border-white/5 rounded-2xl h-[424px] p-5 animate-pulse">
            <div className="flex justify-between mb-6">
              <div className="h-8 w-48 bg-white/10 rounded-lg" />
              <div className="h-8 w-24 bg-white/10 rounded-lg" />
            </div>
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-white/10" />
                    <div className="space-y-2">
                      <div className="h-4 w-40 bg-white/10 rounded" />
                      <div className="h-3 w-16 bg-white/10 rounded" />
                    </div>
                  </div>
                  <div className="h-4 w-16 bg-white/10 rounded" />
                </div>
              ))}
            </div>
          </div>

          {/* Right Column Skeleton (Chart) */}
          <div className="bg-[#111119] border border-white/5 rounded-2xl h-[424px] p-6 animate-pulse flex flex-col">
            <div className="space-y-4 mb-8">
              <div className="h-6 w-32 bg-white/10 rounded" />
              <div className="h-10 w-48 bg-white/10 rounded" />
            </div>
            <div className="flex-1 bg-white/5 rounded-xl" />
            <div className="flex gap-4 mt-4">
              <div className="h-4 w-20 bg-white/10 rounded" />
              <div className="h-4 w-20 bg-white/10 rounded" />
              <div className="h-4 w-20 bg-white/10 rounded" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-12 space-y-6">
      {/* Top Row - Big Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Total Datasets Card */}
        <div className="bg-neutral-900/50 border border-white/5 rounded-2xl p-6 h-[200px] flex flex-col justify-between relative overflow-hidden group">
          <div className="flex items-start justify-between z-10">
            <div>
              <p className="text-neutral-400 text-sm font-medium">
                Total Datasets
              </p>
              <h2 className="text-4xl font-bold text-white mt-2 tracking-tight">
                <CountUp end={12845} />
              </h2>
            </div>
            <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-neutral-400">
              <Database className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm z-10">
            <div className="flex items-center gap-1.5 text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded-md">
              <Bot className="w-3.5 h-3.5" />
              <span className="font-medium">
                <CountUp end={8420} suffix=" AI" />
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-blue-400 bg-blue-400/10 px-2 py-1 rounded-md">
              <User className="w-3.5 h-3.5" />
              <span className="font-medium">
                <CountUp end={4425} suffix=" Human" />
              </span>
            </div>
          </div>
          {/* Decorative bg gradient */}
          <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-linear-to-br from-blue-500/10 to-purple-500/10 rounded-full blur-3xl group-hover:bg-blue-500/20 transition-colors duration-500" />
        </div>

        {/* Total Value Card */}
        <div className="bg-neutral-900/50 border border-white/5 rounded-2xl p-6 h-[200px] flex flex-col justify-between relative overflow-hidden group">
          <div className="flex items-start justify-between z-10">
            <div>
              <p className="text-neutral-400 text-sm font-medium">
                Total Downloads
              </p>
              <h2 className="text-4xl font-bold text-white mt-2 tracking-tight">
                <CountUp end={2.4} prefix="$" suffix="M" decimals={1} />
              </h2>
            </div>
            <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-neutral-400">
              <Activity className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-emerald-400 z-10">
            <TrendingUp className="w-4 h-4" />
            <span className="font-medium">+12.5% this week</span>
          </div>
          {/* Decorative bg gradient */}
          <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-linear-to-br from-emerald-500/10 to-teal-500/10 rounded-full blur-3xl group-hover:bg-emerald-500/20 transition-colors duration-500" />
        </div>

        {/* Total Value Card (Duplicate?) */}
        <div className="bg-neutral-900/50 border border-white/5 rounded-2xl p-6 h-[200px] flex flex-col justify-between relative overflow-hidden group">
          <div className="flex items-start justify-between z-10">
            <div>
              <p className="text-neutral-400 text-sm font-medium">
                Total Dataset Value
              </p>
              <h2 className="text-4xl font-bold text-white mt-2 tracking-tight">
                <CountUp end={2.4} prefix="$" suffix="M" decimals={1} />
              </h2>
            </div>
            <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-neutral-400">
              <Activity className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-emerald-400 z-10">
            <TrendingUp className="w-4 h-4" />
            <span className="font-medium">+12.5% this week</span>
          </div>
          {/* Decorative bg gradient */}
          <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-linear-to-br from-emerald-500/10 to-teal-500/10 rounded-full blur-3xl group-hover:bg-emerald-500/20 transition-colors duration-500" />
        </div>
      </div>

      {/* Bottom Row - Merged Market Activity & Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-2 bg-neutral-900/50 border border-white/5 rounded-2xl overflow-hidden flex flex-col h-[424px]">
          <div className="p-4 border-b border-white/5">
            <div className="flex items-center justify-between gap-4">
              <div className="flex p-1 bg-white/5 rounded-lg w-full">
                <button
                  onClick={() => setMarketTab("activity")}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-all ${
                    marketTab === "activity"
                      ? "bg-neutral-800 text-white shadow-sm"
                      : "text-neutral-400 hover:text-neutral-200 hover:bg-white/5"
                  }`}
                >
                  <ActivityIcon className="w-4 h-4" />
                  Live Activity
                </button>
                <button
                  onClick={() => setMarketTab("contributors")}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-all ${
                    marketTab === "contributors"
                      ? "bg-neutral-800 text-white shadow-sm"
                      : "text-neutral-400 hover:text-neutral-200 hover:bg-white/5"
                  }`}
                >
                  <Trophy className="w-4 h-4" />
                  Top Contributors
                </button>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2">
            <div className="space-y-1">
              {marketTab === "activity" ? (
                activities.length > 0 ? (
                  activities.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-3 rounded-xl hover:bg-white/5 transition-colors group"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center border ${
                            item.eventType === "download"
                              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                              : item.type === "ai"
                              ? "bg-purple-500/10 border-purple-500/20 text-purple-400"
                              : "bg-blue-500/10 border-blue-500/20 text-blue-400"
                          }`}
                        >
                          {item.eventType === "download" ? (
                            <Download className="w-4 h-4" />
                          ) : item.type === "ai" ? (
                            <Bot className="w-4 h-4" />
                          ) : (
                            <User className="w-4 h-4" />
                          )}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-neutral-200 group-hover:text-white truncate max-w-[160px]">
                            {item.title}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-neutral-500">
                            <Clock className="w-3 h-3" />
                            {item.timestamp}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-mono font-medium text-emerald-400">
                          {item.value}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-neutral-500">
                    <ActivityIcon className="w-12 h-12 mb-2 opacity-30" />
                    <p className="text-sm">No recent activity</p>
                  </div>
                )
              ) : (
                MOCK_CONTRIBUTORS.map((contributor) => (
                  <div
                    key={contributor.id}
                    className="flex items-center justify-between p-3 rounded-xl hover:bg-white/5 transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 flex items-center justify-center text-xs font-bold text-neutral-600 bg-white/5 rounded-full">
                        {contributor.rank}
                      </div>
                      <div className="w-8 h-8 rounded-full bg-linear-to-br from-neutral-700 to-neutral-800 border border-white/5 flex items-center justify-center text-xs font-bold text-white">
                        {contributor.name.substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-neutral-200 group-hover:text-white">
                          {contributor.name}
                        </div>
                        <div className="text-xs text-neutral-500 font-mono">
                          {contributor.address}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-mono font-medium text-emerald-400">
                        {contributor.volume}
                      </div>
                      <div className="text-xs text-neutral-500">
                        {contributor.items} uploads
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Column - Revenue Chart (Compact) */}
        <div className="lg:col-span-3 bg-[#111119] border border-white/5 rounded-2xl p-6 h-[424px] flex flex-col relative overflow-hidden group">
          <div className="flex items-start justify-between mb-2 z-10">
            <div>
              <p className="text-neutral-400 text-sm font-medium mb-1">
                Total Revenue
              </p>
              <h2 className="text-3xl font-bold text-white tracking-tight">
                <CountUp end={61834.7} prefix="$" decimals={2} />
              </h2>
            </div>
            <div className="flex items-center gap-1 text-xs font-medium text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-full border border-emerald-500/20">
              <TrendingUp className="w-3 h-3" />
              +24.5%
            </div>
          </div>

          <div className="flex-1 w-full -ml-4 mt-4 relative z-0">
            {/* Floating Badge */}
            <div className="absolute top-10 right-10 z-20 bg-lime-400 text-black px-2 py-1 rounded-full font-bold text-xs shadow-lg shadow-lime-400/20 transform rotate-3">
              <CountUp end={24185.5} prefix="$" decimals={2} />
            </div>
            <ResponsiveContainer width="115%" height="100%">
              <AreaChart data={CHART_DATA}>
                <defs>
                  <linearGradient id="colorValue1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorValue2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#a3e635" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#a3e635" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorValue3" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="date"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#525252", fontSize: 10 }}
                  dy={10}
                />
                {/* YAxis removed as requested */}
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1A1A24",
                    borderColor: "#333",
                    borderRadius: "12px",
                  }}
                  itemStyle={{ color: "#fff" }}
                />
                <Area
                  type="monotone"
                  dataKey="value1"
                  stroke="#8b5cf6"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorValue1)"
                />
                <Area
                  type="monotone"
                  dataKey="value2"
                  stroke="#a3e635"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorValue2)"
                />
                <Area
                  type="monotone"
                  dataKey="value3"
                  stroke="#6366f1"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorValue3)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Compact Legend */}
          <div className="flex items-center justify-between pt-4 border-t border-white/5 mt-2 z-10">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-indigo-500" />
              <span className="text-xs text-neutral-400">AI</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-lime-400" />
              <span className="text-xs text-neutral-400">Human</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-purple-500" />
              <span className="text-xs text-neutral-400">Subs</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
