import { createClient } from "@clickhouse/client";
import { NextResponse } from "next/server";

// ClickHouse configuration for Railway
const clickhouseClient = createClient({
  url: process.env.CLICKHOUSE_URL || "http://localhost:8123",
  username: process.env.CLICKHOUSE_USER || "default",
  password: process.env.CLICKHOUSE_PASSWORD || "password",
  // Railway often requires explicit request timeout
  request_timeout: 60000,
});

export interface DatasetEvent {
  block_number: number;
  timestamp: number;
  text_id: string;
  description: string;
  price_usdc: string;
  pay_address: string;
  tx_hash: string;
}

export async function GET() {
  try {
    // Query ClickHouse for all events, ordered by block number descending (newest first)
    const result = await clickhouseClient.query({
      query: `
        SELECT 
          block_number,
          timestamp,
          text_id,
          description,
          price_usdc,
          pay_address,
          tx_hash
        FROM bahack_events
        ORDER BY block_number DESC
        LIMIT 100
      `,
      format: "JSONEachRow",
    });

    const events = await result.json<DatasetEvent>();

    return NextResponse.json({
      success: true,
      count: events.length,
      events,
    });
  } catch (error) {
    console.error("Error fetching events from ClickHouse:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch events",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
