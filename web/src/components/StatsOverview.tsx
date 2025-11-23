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
  Upload,
} from "lucide-react";
import { useState, useEffect, useRef, useMemo } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from "recharts";

// Types
interface ActivityItem {
  id: string;
  title: string;
  type: "ai" | "human" | "download";
  timestamp: string;
  rawTimestamp: number; // Raw timestamp for sorting
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
    rawTimestamp: Date.now() / 1000 - 120,
    value: "$45.00",
    isPositive: true,
  },
  {
    id: "2",
    title: "Global Temperature Trends",
    type: "human",
    timestamp: "15m ago",
    rawTimestamp: Date.now() / 1000 - 900,
    value: "Free",
    isPositive: true,
  },
  {
    id: "3",
    title: "Crypto Market Sentiment Q3",
    type: "ai",
    timestamp: "42m ago",
    rawTimestamp: Date.now() / 1000 - 2520,
    value: "$120.00",
    isPositive: true,
  },
  {
    id: "4",
    title: "Urban Traffic Patterns NYC",
    type: "human",
    timestamp: "1h ago",
    rawTimestamp: Date.now() / 1000 - 3600,
    value: "$15.50",
    isPositive: true,
  },
  {
    id: "5",
    title: "Solar Flare Predictions",
    type: "ai",
    timestamp: "2h ago",
    rawTimestamp: Date.now() / 1000 - 7200,
    value: "$80.00",
    isPositive: true,
  },
  {
    id: "6",
    title: "Genome Sequencing Batch A",
    type: "ai",
    timestamp: "3h ago",
    rawTimestamp: Date.now() / 1000 - 10800,
    value: "$250.00",
    isPositive: true,
  },
];

// Function to generate random contributor names
const generateContributorName = (address: string): string => {
  const prefixes = [
    "DataLab",
    "Research",
    "OpenMetrics",
    "Quantum",
    "Civic",
    "Neural",
    "Insight",
    "Synapse",
    "Axiom",
    "Vector",
    "Matrix",
    "Catalyst",
    "Zenith",
    "Nexus",
    "Prime",
  ];
  const suffixes = [
    "AI",
    "DAO",
    "Labs",
    "Sense",
    "Data",
    "Systems",
    "Network",
    "Core",
    "Hub",
    "Protocol",
    "Forge",
    "Collective",
  ];

  // Use address hash to deterministically pick name components
  const addressHash = address
    .split("")
    .reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const prefix = prefixes[addressHash % prefixes.length];
  const suffix = suffixes[(addressHash * 2) % suffixes.length];

  return `${prefix}_${suffix}`;
};

const MOCK_CONTRIBUTORS: TopContributor[] = [];

// Dataset tag mapping based on keywords
const getDatasetTag = (name: string, description: string = ""): string => {
  const text = `${name} ${description}`.toLowerCase();

  if (
    text.match(
      /ai|artificial intelligence|machine learning|ml|neural|deep learning|model/
    )
  ) {
    return "AI";
  }
  if (
    text.match(
      /finance|financial|stock|market|trading|investment|bank|crypto|blockchain|bitcoin|ethereum|defi/
    )
  ) {
    return "Finance";
  }
  if (
    text.match(
      /healthcare|health|medical|hospital|patient|disease|drug|clinical/
    )
  ) {
    return "Healthcare";
  }
  if (text.match(/research|science|academic|study|analysis|data/)) {
    return "Research";
  }
  if (text.match(/social|media|twitter|facebook|instagram|sentiment/)) {
    return "Social";
  }

  return "Other";
};

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
  const [totalDatasets, setTotalDatasets] = useState(0);
  const [totalDownloads, setTotalDownloads] = useState(0);
  const [totalDatasetValue, setTotalDatasetValue] = useState(0);
  const [datasetChartData, setDatasetChartData] = useState<
    Array<{
      time: string;
      uploads: number;
      downloads: number;
    }>
  >([]);
  const [tagCounts, setTagCounts] = useState({
    AI: 0,
    Finance: 0,
    Healthcare: 0,
    Research: 0,
    Other: 0,
  });
  const [contributors, setContributors] = useState<TopContributor[]>([]);
  const [rawEvents, setRawEvents] = useState<DatasetEvent[]>([]);

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

        // Calculate statistics
        let datasetCount = 0;
        let downloadCount = 0;
        let totalValue = 0;

        // Store raw events for chart processing
        if (eventsData.success && eventsData.events) {
          setRawEvents(eventsData.events);
        }

        // Process events (uploads)
        if (eventsData.success && eventsData.events) {
          datasetCount = eventsData.events.length;

          eventsData.events.forEach((event: DatasetEvent) => {
            // Calculate total dataset value
            const priceInUSDC = parseFloat(event.price_usdc) / 1e6;
            totalValue += priceInUSDC;

            combinedActivities.push({
              id: `event-${event.tx_hash}`,
              title: event.name,
              type: "ai", // You can determine this based on some logic if needed
              timestamp: formatTimestamp(event.timestamp),
              rawTimestamp: event.timestamp,
              value: event.price_usdc === "0" ? "Free" : `$${priceInUSDC}`,
              isPositive: true,
              eventType: "upload",
            });
          });
        }

        // Process downloads
        if (downloadsData.success && downloadsData.downloads) {
          downloadCount = downloadsData.downloads.length;

          downloadsData.downloads.forEach((download: DownloadEvent) => {
            combinedActivities.push({
              id: `download-${download.x402_tx_hash || download.tx_hash}`,
              title: download.name,
              type: "download",
              timestamp: formatTimestamp(download.timestamp),
              rawTimestamp: download.timestamp,
              value:
                download.price_usdc === "0"
                  ? "Free"
                  : `$${parseFloat(download.price_usdc) / 1e6}`,
              isPositive: true,
              eventType: "download",
            });
          });
        }

        // Update statistics
        setTotalDatasets(datasetCount);
        setTotalDownloads(downloadCount);
        setTotalDatasetValue(totalValue);

        // Process contributors data
        if (eventsData.success && eventsData.events) {
          const contributorMap: {
            [address: string]: { totalValue: number; count: number };
          } = {};

          eventsData.events.forEach((event: DatasetEvent) => {
            const address = event.pay_address;
            const priceInUSDC = parseFloat(event.price_usdc) / 1e6;

            if (!contributorMap[address]) {
              contributorMap[address] = { totalValue: 0, count: 0 };
            }

            contributorMap[address].totalValue += priceInUSDC;
            contributorMap[address].count += 1;
          });

          // Convert to array and sort by total value
          const contributorsArray = Object.entries(contributorMap)
            .map(([address, data]) => ({
              id: address,
              name: generateContributorName(address),
              address: `${address.slice(0, 4)}...${address.slice(-4)}`,
              volume: `$${data.totalValue.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}`,
              items: data.count,
              rank: 0, // Will be set below
            }))
            .sort((a, b) => {
              const aValue = parseFloat(a.volume.replace(/[$,]/g, ""));
              const bValue = parseFloat(b.volume.replace(/[$,]/g, ""));
              return bValue - aValue;
            })
            .slice(0, 10) // Top 10 contributors
            .map((contributor, index) => ({
              ...contributor,
              rank: index + 1,
            }));

          setContributors(contributorsArray);
        }

        // Sort by timestamp (newest first)
        combinedActivities.sort((a, b) => {
          return b.rawTimestamp - a.rawTimestamp;
        });

        const newActivities = combinedActivities.slice(0, 20); // Limit to 20 most recent

        // Only update if data has changed
        setActivities((prevActivities) => {
          const hasChanged =
            JSON.stringify(prevActivities) !== JSON.stringify(newActivities);
          return hasChanged ? newActivities : prevActivities;
        });

        setLoading(false);
      } catch (error) {
        console.error("Error fetching activities:", error);
        // Only set mock data on first load
        setActivities((prevActivities) =>
          prevActivities.length === 0 ? MOCK_ACTIVITIES : prevActivities
        );
        setLoading(false);
      }
    };

    // Initial fetch
    fetchActivities();

    // Poll every 10 seconds
    const intervalId = setInterval(() => {
      fetchActivities();
    }, 10000);

    // Cleanup interval on unmount
    return () => clearInterval(intervalId);
  }, []);

  // Process chart data based on raw events and selected time frame
  // Process uploads vs downloads data with automatic time intervals
  useEffect(() => {
    const processActivityData = async () => {
      try {
        const [eventsRes, downloadsRes] = await Promise.all([
          fetch("/api/events"),
          fetch("/api/downloads"),
        ]);

        const eventsData = await eventsRes.json();
        const downloadsData = await downloadsRes.json();

        if (!eventsData.success || !downloadsData.success) return;

        const uploads = eventsData.events || [];
        const downloads = downloadsData.downloads || [];

        // Also update tag counts from uploads
        const totalTagCounts = {
          AI: 0,
          Finance: 0,
          Healthcare: 0,
          Research: 0,
          Other: 0,
        };

        uploads.forEach((event: DatasetEvent) => {
          const tag = getDatasetTag(event.name, event.description);
          if (tag === "AI") totalTagCounts.AI++;
          else if (tag === "Finance") totalTagCounts.Finance++;
          else if (tag === "Healthcare") totalTagCounts.Healthcare++;
          else if (tag === "Research") totalTagCounts.Research++;
          else totalTagCounts.Other++;
        });

        setTagCounts(totalTagCounts);

        // Combine all timestamps to determine time range
        const allTimestamps = [
          ...uploads.map((e: DatasetEvent) => e.timestamp),
          ...downloads.map((d: DownloadEvent) => d.timestamp),
        ];

        if (allTimestamps.length === 0) return;

        const minTimestamp = Math.min(...allTimestamps);
        const maxTimestamp = Math.max(...allTimestamps);
        const timeRangeSeconds = maxTimestamp - minTimestamp;

        // Determine grouping interval based on time range
        let formatLabel: (date: Date) => string;

        if (timeRangeSeconds < 60 * 60) {
          // Less than 1 hour - group by 5 minutes
          formatLabel = (date: Date) => {
            const hours = date.getHours().toString().padStart(2, "0");
            const mins = (Math.floor(date.getMinutes() / 5) * 5)
              .toString()
              .padStart(2, "0");
            return `${hours}:${mins}`;
          };
        } else if (timeRangeSeconds < 24 * 60 * 60) {
          // Less than 24 hours - group by 30 minutes
          formatLabel = (date: Date) => {
            const hours = date.getHours().toString().padStart(2, "0");
            const mins = (Math.floor(date.getMinutes() / 30) * 30)
              .toString()
              .padStart(2, "0");
            return `${hours}:${mins}`;
          };
        } else if (timeRangeSeconds < 7 * 24 * 60 * 60) {
          // Less than 7 days - group by 4 hours
          formatLabel = (date: Date) => {
            const day = date.getDate().toString().padStart(2, "0");
            const month = (date.getMonth() + 1).toString().padStart(2, "0");
            const hours = (Math.floor(date.getHours() / 4) * 4)
              .toString()
              .padStart(2, "0");
            return `${day}.${month} ${hours}h`;
          };
        } else {
          // More than 7 days - group by day
          formatLabel = (date: Date) =>
            `${date.getDate().toString().padStart(2, "0")}.${(
              date.getMonth() + 1
            )
              .toString()
              .padStart(2, "0")}`;
        }

        // Group data by time intervals
        const activityByTime: {
          [time: string]: { uploads: number; downloads: number };
        } = {};

        // Process uploads
        uploads.forEach((event: DatasetEvent) => {
          const eventDate = new Date(event.timestamp * 1000);
          const timeKey = formatLabel(eventDate);

          if (!activityByTime[timeKey]) {
            activityByTime[timeKey] = { uploads: 0, downloads: 0 };
          }
          activityByTime[timeKey].uploads++;
        });

        // Process downloads
        downloads.forEach((download: DownloadEvent) => {
          const downloadDate = new Date(download.timestamp * 1000);
          const timeKey = formatLabel(downloadDate);

          if (!activityByTime[timeKey]) {
            activityByTime[timeKey] = { uploads: 0, downloads: 0 };
          }
          activityByTime[timeKey].downloads++;
        });

        // Convert to array and sort
        const chartData = Object.entries(activityByTime)
          .map(([time, counts]) => ({
            time,
            uploads: counts.uploads,
            downloads: counts.downloads,
          }))
          .sort((a, b) => a.time.localeCompare(b.time));

        // Limit data points for better visualization
        const maxDataPoints = Math.min(20, chartData.length);
        const finalChartData =
          chartData.length > maxDataPoints
            ? chartData.slice(-maxDataPoints)
            : chartData;

        setDatasetChartData(finalChartData);
      } catch (error) {
        console.error("Error processing activity data:", error);
      }
    };

    processActivityData();
    // Refresh every 10 seconds
    const interval = setInterval(processActivityData, 10000);
    return () => clearInterval(interval);
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
                <CountUp end={totalDatasets} />
              </h2>
            </div>
            <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-neutral-400">
              <Database className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs z-10 flex-wrap">
            <div className="flex items-center gap-1 text-purple-400 bg-purple-400/10 px-2 py-1 rounded-md">
              <div className="w-1.5 h-1.5 rounded-full bg-purple-500" />
              <span className="font-medium">
                AI: <CountUp end={tagCounts.AI} />
              </span>
            </div>
            <div className="flex items-center gap-1 text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded-md">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span className="font-medium">
                Finance: <CountUp end={tagCounts.Finance} />
              </span>
            </div>
            <div className="flex items-center gap-1 text-amber-400 bg-amber-400/10 px-2 py-1 rounded-md">
              <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              <span className="font-medium">
                Healthcare: <CountUp end={tagCounts.Healthcare} />
              </span>
            </div>
            <div className="flex items-center gap-1 text-blue-400 bg-blue-400/10 px-2 py-1 rounded-md">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
              <span className="font-medium">
                Research: <CountUp end={tagCounts.Research} />
              </span>
            </div>
            <div className="flex items-center gap-1 text-gray-400 bg-gray-400/10 px-2 py-1 rounded-md">
              <div className="w-1.5 h-1.5 rounded-full bg-gray-500" />
              <span className="font-medium">
                Other: <CountUp end={tagCounts.Other} />
              </span>
            </div>
          </div>
          {/* Decorative bg gradient */}
          <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-linear-to-br from-blue-500/10 to-purple-500/10 rounded-full blur-3xl group-hover:bg-blue-500/20 transition-colors duration-500" />
        </div>

        {/* Total Downloads Card */}
        <div className="bg-neutral-900/50 border border-white/5 rounded-2xl p-6 h-[200px] flex flex-col justify-between relative overflow-hidden group">
          <div className="flex items-start justify-between z-10">
            <div>
              <p className="text-neutral-400 text-sm font-medium">
                Total Downloads
              </p>
              <h2 className="text-4xl font-bold text-white mt-2 tracking-tight">
                <CountUp end={totalDownloads} />
              </h2>
            </div>
            <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-neutral-400">
              <Download className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-emerald-400 z-10">
            <TrendingUp className="w-4 h-4" />
            <span className="font-medium">Live data</span>
          </div>
          {/* Decorative bg gradient */}
          <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-linear-to-br from-emerald-500/10 to-teal-500/10 rounded-full blur-3xl group-hover:bg-emerald-500/20 transition-colors duration-500" />
        </div>

        {/* Total Dataset Value Card */}
        <div className="bg-neutral-900/50 border border-white/5 rounded-2xl p-6 h-[200px] flex flex-col justify-between relative overflow-hidden group">
          <div className="flex items-start justify-between z-10">
            <div>
              <p className="text-neutral-400 text-sm font-medium">
                Total Dataset Value
              </p>
              <h2 className="text-4xl font-bold text-white mt-2 tracking-tight">
                {totalDatasetValue >= 1000000 ? (
                  <CountUp
                    end={totalDatasetValue / 1000000}
                    prefix="$"
                    suffix="M"
                  />
                ) : totalDatasetValue >= 1000 ? (
                  <CountUp
                    end={totalDatasetValue / 1000}
                    prefix="$"
                    suffix="K"
                  />
                ) : (
                  <CountUp end={totalDatasetValue} prefix="$" />
                )}
              </h2>
            </div>
            <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-neutral-400">
              <Activity className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-emerald-400 z-10">
            <TrendingUp className="w-4 h-4" />
            <span className="font-medium">Total USDC value</span>
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
                              : item.eventType === "upload"
                              ? "bg-blue-500/10 border-blue-500/20 text-blue-400"
                              : "bg-purple-500/10 border-purple-500/20 text-purple-400"
                          }`}
                        >
                          {item.eventType === "download" ? (
                            <Download className="w-4 h-4" />
                          ) : item.eventType === "upload" ? (
                            <Upload className="w-4 h-4" />
                          ) : (
                            <Bot className="w-4 h-4" />
                          )}
                        </div>
                        <div>
                          <div
                            className="text-sm font-medium text-neutral-200 group-hover:text-white truncate max-w-[240px]"
                            title={item.title}
                          >
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
              ) : contributors.length > 0 ? (
                contributors.map((contributor) => (
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
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-neutral-500">
                  <Trophy className="w-12 h-12 mb-2 opacity-30" />
                  <p className="text-sm">No contributors yet</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column - Uploads vs Downloads Chart */}
        <div className="lg:col-span-3 bg-[#111119] border border-white/5 rounded-2xl p-6 h-[424px] flex flex-col relative overflow-hidden group">
          <div className="flex items-start justify-between mb-2 z-10">
            <div>
              <p className="text-neutral-400 text-sm font-medium mb-1">
                Platform Activity
              </p>
              <h2 className="text-3xl font-bold text-white tracking-tight">
                Uploads vs Downloads
              </h2>
            </div>
            <div className="flex items-center gap-1 text-xs font-medium text-blue-400 bg-blue-500/10 px-2 py-1 rounded-full border border-blue-500/20">
              <Activity className="w-3 h-3" />
              Live
            </div>
          </div>

          <div className="flex-1 w-full -ml-4 mt-4 relative z-0">
            <ResponsiveContainer width="115%" height="100%">
              <BarChart data={datasetChartData} barGap={1} barCategoryGap={2}>
                <defs>
                  <linearGradient
                    id="uploadGradient"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={1} />
                    <stop offset="100%" stopColor="#1d4ed8" stopOpacity={0.9} />
                  </linearGradient>
                  <linearGradient
                    id="downloadGradient"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="0%" stopColor="#10b981" stopOpacity={1} />
                    <stop offset="100%" stopColor="#047857" stopOpacity={0.9} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="time"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#525252", fontSize: 10 }}
                  dy={10}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#525252", fontSize: 10 }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1A1A24",
                    borderColor: "#333",
                    borderRadius: "12px",
                  }}
                  itemStyle={{ color: "#fff" }}
                  cursor={{ fill: "rgba(255, 255, 255, 0.05)" }}
                />
                <Legend
                  wrapperStyle={{
                    paddingTop: "10px",
                    fontSize: "12px",
                  }}
                  iconType="rect"
                  iconSize={10}
                  formatter={(value: string) => (
                    <span style={{ color: "#d1d5db" }}>{value}</span>
                  )}
                />
                <Bar
                  dataKey="uploads"
                  fill="url(#uploadGradient)"
                  radius={[4, 4, 0, 0]}
                  name="Uploads"
                  minPointSize={2}
                />
                <Bar
                  dataKey="downloads"
                  fill="url(#downloadGradient)"
                  radius={[4, 4, 0, 0]}
                  name="Downloads"
                  minPointSize={2}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
