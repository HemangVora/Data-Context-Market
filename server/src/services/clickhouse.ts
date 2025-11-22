import { createClient } from "@clickhouse/client";
import { clickhouseUrl, clickhouseUser, clickhousePassword } from "../config.js";

// ClickHouse configuration
const clickhouseClient = createClient({
  url: clickhouseUrl,
  username: clickhouseUser,
  password: clickhousePassword,
  request_timeout: 60000,
});

export interface DatasetEvent {
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

/**
 * Fetches all uploaded data from ClickHouse
 * @returns Array of all dataset events
 */
export async function getAllDatasetEvents(): Promise<DatasetEvent[]> {
  try {
    console.log(`[CLICKHOUSE] Fetching all dataset events from ClickHouse...`);
    
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
          tx_hash
        FROM bahack_events
        ORDER BY block_number DESC
      `,
      format: "JSONEachRow",
    });

    const events = await result.json<DatasetEvent>();
    
    console.log(`[CLICKHOUSE] ✓ Fetched ${events.length} events from ClickHouse`);
    return events;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error(`[CLICKHOUSE] ✗ Error fetching events from ClickHouse:`, errorMessage);
    throw new Error(`Failed to fetch events from ClickHouse: ${errorMessage}`);
  }
}

