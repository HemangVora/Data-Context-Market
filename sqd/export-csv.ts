import { createClient } from '@clickhouse/client';
import * as fs from 'fs';

const CONFIG = {
  CLICKHOUSE_URL: process.env.CLICKHOUSE_URL || "http://localhost:8123",
  CLICKHOUSE_USER: process.env.CLICKHOUSE_USER || "default",
  CLICKHOUSE_PASSWORD: process.env.CLICKHOUSE_PASSWORD || "password",
};

async function exportToCsv() {
  const client = createClient({
    url: CONFIG.CLICKHOUSE_URL,
    username: CONFIG.CLICKHOUSE_USER,
    password: CONFIG.CLICKHOUSE_PASSWORD,
  });

  const result = await client.query({
    query: `SELECT block_number, timestamp, event_type, sender, recipient, amount, value1, value2, tx_hash FROM multi_logger_events ORDER BY block_number`,
    format: 'JSONEachRow',
  });

  const rows = await result.json() as Array<{
    block_number: number;
    timestamp: number;
    event_type: string;
    sender: string;
    recipient: string;
    amount: string;
    value1: string;
    value2: string;
    tx_hash: string;
  }>;

  if (rows.length === 0) {
    console.log('No data to export');
    await client.close();
    return;
  }

  const csv = [
    'block_number,timestamp,event_type,sender,recipient,amount,value1,value2,tx_hash',
    ...rows.map(r =>
      `${r.block_number},${r.timestamp},${r.event_type},${r.sender},${r.recipient},${r.amount},${r.value1},${r.value2},${r.tx_hash}`
    )
  ].join('\n');

  const filename = `export_${Date.now()}.csv`;
  fs.writeFileSync(filename, csv);
  console.log(`Exported ${rows.length} rows to ${filename}`);

  await client.close();
}

exportToCsv().catch(console.error);
