import { createClient } from "@clickhouse/client";

const client = createClient({
  url: process.env.CLICKHOUSE_URL || "http://localhost:8123",
  username: process.env.CLICKHOUSE_USER || "default",
  password: process.env.CLICKHOUSE_PASSWORD || "password",
});

async function checkEvents() {
  console.log("Checking events in ClickHouse...\n");

  // Get total upload count
  const countResult = await client.query({
    query: "SELECT COUNT(*) as count FROM bahack_events",
    format: "JSONEachRow",
  });
  const countData = (await countResult.json()) as Array<{ count: string }>;
  console.log("Total upload events:", countData[0]?.count || 0);

  // Get total download count
  const downloadCountResult = await client.query({
    query: "SELECT COUNT(*) as count FROM bahack_downloads",
    format: "JSONEachRow",
  });
  const downloadCountData = (await downloadCountResult.json()) as Array<{
    count: string;
  }>;
  console.log("Total download events:", downloadCountData[0]?.count || 0);

  // Get all upload events
  const result = await client.query({
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
      LIMIT 10
    `,
    format: "JSONEachRow",
  });

  const events = await result.json();
  console.log("\nLatest upload events:");
  console.log(JSON.stringify(events, null, 2));

  // Get all download events
  const downloadResult = await client.query({
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
      LIMIT 10
    `,
    format: "JSONEachRow",
  });

  const downloads = await downloadResult.json();
  console.log("\nLatest download events:");
  console.log(JSON.stringify(downloads, null, 2));

  await client.close();
}

checkEvents().catch(console.error);
