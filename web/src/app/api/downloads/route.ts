import { NextResponse } from "next/server";
import { createClient } from "@clickhouse/client";

// ClickHouse connection
const clickhouseClient = createClient({
  url: process.env.CLICKHOUSE_URL || "http://localhost:8123",
  username: process.env.CLICKHOUSE_USER || "default",
  password: process.env.CLICKHOUSE_PASSWORD || "password",
});

export interface DownloadEvent {
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

export async function GET() {
  try {
    // Query ClickHouse for all download events, ordered by block number descending (newest first)
    const result = await clickhouseClient.query({
      query: `
        SELECT 
          block_number,
          timestamp,
          piece_cid,
          name,
          description,
          filetype,
          price_usdc,
          pay_address,
          tx_hash,
          x402_tx_hash
        FROM bahack_downloads
        ORDER BY block_number DESC
        LIMIT 100
      `,
      format: "JSONEachRow",
    });

    const downloads = await result.json<DownloadEvent>();

    return NextResponse.json({
      success: true,
      count: downloads.length,
      downloads,
    });
  } catch (error) {
    console.error("Error fetching downloads from ClickHouse:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch downloads",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
