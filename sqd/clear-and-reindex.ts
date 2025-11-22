import { createClient } from "@clickhouse/client";

const client = createClient({
  url: process.env.CLICKHOUSE_URL || "http://localhost:8123",
  username: process.env.CLICKHOUSE_USER || "default",
  password: process.env.CLICKHOUSE_PASSWORD || "password",
});

async function clearDatabase() {
  console.log("🗑️  Clearing bahack_events table...");

  try {
    // Drop the existing table
    await client.command({
      query: "DROP TABLE IF EXISTS bahack_events",
    });
    console.log("✅ Table dropped successfully");

    console.log("\n📝 Instructions:");
    console.log("1. Go to Railway dashboard");
    console.log("2. Find your indexer service");
    console.log("3. Click 'Redeploy' to restart indexing from scratch");
    console.log(
      "\nThe table will be recreated automatically when the indexer starts."
    );
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await client.close();
  }
}

clearDatabase();
