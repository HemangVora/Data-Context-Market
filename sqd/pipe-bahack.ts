import { createClient } from "@clickhouse/client";
import {
  evmPortalSource,
  EvmQueryBuilder,
  type EvmPortalData,
} from "@subsquid/pipes/evm";
import { clickhouseTarget } from "@subsquid/pipes/targets/clickhouse";
import { keccak256, toBytes, decodeAbiParameters } from "viem";

// Configuration
const CONFIG = {
  CONTRACT_ADDRESS:
    process.env.CONTRACT_ADDRESS ||
    "0x5b0b1cbF40C910f58B8Ff1d48A629f257a556B99",
  FROM_BLOCK: parseInt(process.env.FROM_BLOCK || "9680000"),
  PORTAL_URL:
    process.env.PORTAL_URL ||
    "https://portal.sqd.dev/datasets/ethereum-sepolia",

  CLICKHOUSE_URL: process.env.CLICKHOUSE_URL || "http://localhost:8123",
  CLICKHOUSE_USER: process.env.CLICKHOUSE_USER || "default",
  CLICKHOUSE_PASSWORD: process.env.CLICKHOUSE_PASSWORD || "password",
};

// Event signature: DataUploaded(string,string,uint256,string,uint256)
const DATA_UPLOADED_TOPIC = keccak256(
  toBytes("DataUploaded(string,string,uint256,string,uint256)")
);

async function main() {
  console.log("==============================================");
  console.log("Configuration:");
  console.log("==============================================");
  console.log("CONTRACT_ADDRESS:", CONFIG.CONTRACT_ADDRESS);
  console.log("FROM_BLOCK:", CONFIG.FROM_BLOCK);
  console.log("CLICKHOUSE_URL:", CONFIG.CLICKHOUSE_URL);
  console.log("CLICKHOUSE_USER:", CONFIG.CLICKHOUSE_USER);
  console.log(
    "CLICKHOUSE_PASSWORD:",
    CONFIG.CLICKHOUSE_PASSWORD ? "***SET***" : "***NOT SET***"
  );
  console.log("==============================================");
  console.log("DataUploaded event signature:", DATA_UPLOADED_TOPIC);

  const queryBuilder = new EvmQueryBuilder()
    .addFields({
      block: { number: true, hash: true, timestamp: true },
      log: { address: true, topics: true, data: true, transactionHash: true },
    })
    .addLog({
      request: {
        address: [CONFIG.CONTRACT_ADDRESS.toLowerCase()],
        topic0: [DATA_UPLOADED_TOPIC],
      },
      range: { from: CONFIG.FROM_BLOCK },
    });

  await evmPortalSource({
    portal: CONFIG.PORTAL_URL,
    query: queryBuilder,
  })
    .pipe({
      transform: (data: EvmPortalData<any>) => {
        const events: Array<{
          block_number: number;
          timestamp: number;
          text_id: string;
          description: string;
          price_usdc: string;
          pay_address: string;
          tx_hash: string;
        }> = [];

        for (const block of data.blocks) {
          for (const log of block.logs) {
            try {
              // Decode the event data (all fields are non-indexed)
              const decoded = decodeAbiParameters(
                [
                  { name: "Id", type: "string" },
                  { name: "description", type: "string" },
                  { name: "priceUSDC", type: "uint256" },
                  { name: "payAddress", type: "string" },
                  { name: "timestamp", type: "uint256" },
                ],
                log.data as `0x${string}`
              );

              events.push({
                block_number: block.header.number,
                timestamp: block.header.timestamp,
                text_id: decoded[0] as string,
                description: decoded[1] as string,
                price_usdc: (decoded[2] as bigint).toString(),
                pay_address: decoded[3] as string,
                tx_hash: log.transactionHash,
              });
            } catch (e) {
              console.error("Failed to decode event:", e);
            }
          }
        }

        return events;
      },
    })
    .pipeTo(
      clickhouseTarget({
        client: createClient({
          username: CONFIG.CLICKHOUSE_USER,
          password: CONFIG.CLICKHOUSE_PASSWORD,
          url: CONFIG.CLICKHOUSE_URL,
        }),
        onStart: async ({ store }) => {
          await store.command({
            query: `
              CREATE TABLE IF NOT EXISTS bahack_events (
                block_number  UInt64,
                timestamp     UInt64,
                text_id       String,
                description   String,
                price_usdc    String,
                pay_address   String,
                tx_hash       String
              )
              ENGINE = ReplacingMergeTree()
              ORDER BY (block_number, tx_hash, text_id)
            `,
          });
          console.log("Table bahack_events created/verified");
        },
        onData: async ({ data, store }) => {
          if (data.length > 0) {
            await store.insert({
              table: "bahack_events",
              values: data,
              format: "JSONEachRow",
            });
            console.log(`Inserted ${data.length} events`);
          }
        },
        onRollback: async ({ safeCursor, store }) => {
          await store.removeAllRows({
            tables: ["bahack_events"],
            where: `block_number > {latest:UInt64}`,
            params: { latest: safeCursor.number },
          });
        },
      })
    );
}

void main();
