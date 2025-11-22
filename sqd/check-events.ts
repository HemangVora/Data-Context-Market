import { createClient } from "@clickhouse/client";

const client = createClient({
  url: process.env.CLICKHOUSE_URL || "http://localhost:8123",
  username: process.env.CLICKHOUSE_USER || "default",
  password: process.env.CLICKHOUSE_PASSWORD || "password",
});

async function checkEvents() {
  console.log("Checking events in ClickHouse...\n");

  // Get total count
  const countResult = await client.query({
    query: "SELECT COUNT(*) as count FROM bahack_events",
    format: "JSONEachRow",
  });
  const countData = await countResult.json();
  console.log("Total events:", countData[0]?.count || 0);

  // Get all events
  const result = await client.query({
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
      LIMIT 10
    `,
    format: "JSONEachRow",
  });

  const events = await result.json();
  console.log("\nLatest events:");
  console.log(JSON.stringify(events, null, 2));

  // Check for specific transaction
  const txHash =
    "0x597a7b566dab7d334b3c8b70f64c75225edcce3dfa16547c144c2ccffd2cf4fc";
  const txResult = await client.query({
    query: `
      SELECT * FROM bahack_events 
      WHERE tx_hash = '${txHash}'
    `,
    format: "JSONEachRow",
  });

  const txEvents = await txResult.json();
  console.log(`\nLooking for transaction ${txHash}:`);
  console.log(
    txEvents.length > 0 ? JSON.stringify(txEvents, null, 2) : "NOT FOUND"
  );

  await client.close();
}

checkEvents().catch(console.error);
