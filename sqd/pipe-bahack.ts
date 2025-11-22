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

// Event signature: DataUploaded(string,string,string,string,uint256,string,uint256)
// Order: pieceCid, name, description, filetype, priceUSDC, payAddress, timestamp
const DATA_UPLOADED_TOPIC = keccak256(
  toBytes("DataUploaded(string,string,string,string,uint256,string,uint256)")
);

// Event signature: DataDownloaded(string,string,string,string,uint256,string,uint256,string)
// Order: pieceCid, name, description, filetype, priceUSDC, payAddress, timestamp, x402TxHash
const DATA_DOWNLOADED_TOPIC = keccak256(
  toBytes(
    "DataDownloaded(string,string,string,string,uint256,string,uint256,string)"
  )
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
  console.log("DataDownloaded event signature:", DATA_DOWNLOADED_TOPIC);

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
    })
    .addLog({
      request: {
        address: [CONFIG.CONTRACT_ADDRESS.toLowerCase()],
        topic0: [DATA_DOWNLOADED_TOPIC],
      },
      range: { from: CONFIG.FROM_BLOCK },
    });

  await evmPortalSource({
    portal: CONFIG.PORTAL_URL,
    query: queryBuilder,
  })
    .pipe({
      transform: (data: EvmPortalData<any>) => {
        const uploadEvents: Array<{
          block_number: number;
          timestamp: number;
          piece_cid: string;
          name: string;
          description: string;
          filetype: string;
          price_usdc: string;
          pay_address: string;
          tx_hash: string;
        }> = [];

        const downloadEvents: Array<{
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
        }> = [];

        for (const block of data.blocks) {
          for (const log of block.logs) {
            try {
              const eventTopic = log.topics[0];

              if (eventTopic === DATA_UPLOADED_TOPIC) {
                // Decode DataUploaded event
                // Order: pieceCid, name, description, filetype, priceUSDC, payAddress, timestamp
                const decoded = decodeAbiParameters(
                  [
                    { name: "pieceCid", type: "string" },
                    { name: "name", type: "string" },
                    { name: "description", type: "string" },
                    { name: "filetype", type: "string" },
                    { name: "priceUSDC", type: "uint256" },
                    { name: "payAddress", type: "string" },
                    { name: "timestamp", type: "uint256" },
                  ],
                  log.data as `0x${string}`
                );

                uploadEvents.push({
                  block_number: block.header.number,
                  timestamp: block.header.timestamp,
                  piece_cid: decoded[0] as string,
                  name: decoded[1] as string,
                  description: decoded[2] as string,
                  filetype: decoded[3] as string,
                  price_usdc: (decoded[4] as bigint).toString(),
                  pay_address: decoded[5] as string,
                  tx_hash: log.transactionHash,
                });
              } else if (eventTopic === DATA_DOWNLOADED_TOPIC) {
                // Decode DataDownloaded event
                // Order: pieceCid, name, description, filetype, priceUSDC, payAddress, timestamp, x402TxHash
                const decoded = decodeAbiParameters(
                  [
                    { name: "pieceCid", type: "string" },
                    { name: "name", type: "string" },
                    { name: "description", type: "string" },
                    { name: "filetype", type: "string" },
                    { name: "priceUSDC", type: "uint256" },
                    { name: "payAddress", type: "string" },
                    { name: "timestamp", type: "uint256" },
                    { name: "x402TxHash", type: "string" },
                  ],
                  log.data as `0x${string}`
                );

                downloadEvents.push({
                  block_number: block.header.number,
                  timestamp: block.header.timestamp,
                  piece_cid: decoded[0] as string,
                  name: decoded[1] as string,
                  description: decoded[2] as string,
                  filetype: decoded[3] as string,
                  price_usdc: (decoded[4] as bigint).toString(),
                  pay_address: decoded[5] as string,
                  tx_hash: log.transactionHash,
                  x402_tx_hash: decoded[7] as string,
                });
              }
            } catch (e) {
              console.error("Failed to decode event:", e);
              console.error("Log data:", log);
            }
          }
        }

        return { uploadEvents, downloadEvents };
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
          // Create uploads table
          await store.command({
            query: `
              CREATE TABLE IF NOT EXISTS bahack_events (
                block_number  UInt64,
                timestamp     UInt64,
                piece_cid     String,
                name          String,
                description   String,
                filetype      String,
                price_usdc    String,
                pay_address   String,
                tx_hash       String
              )
              ENGINE = ReplacingMergeTree()
              ORDER BY (block_number, tx_hash, piece_cid)
            `,
          });
          console.log("Table bahack_events created/verified");

          // Create downloads table
          await store.command({
            query: `
              CREATE TABLE IF NOT EXISTS bahack_downloads (
                block_number  UInt64,
                timestamp     UInt64,
                piece_cid     String,
                name          String,
                description   String,
                filetype      String,
                price_usdc    String,
                pay_address   String,
                tx_hash       String,
                x402_tx_hash  String
              )
              ENGINE = ReplacingMergeTree()
              ORDER BY (block_number, tx_hash, piece_cid)
            `,
          });
          console.log("Table bahack_downloads created/verified");
        },
        onData: async ({ data, store }) => {
          if (data.uploadEvents.length > 0) {
            await store.insert({
              table: "bahack_events",
              values: data.uploadEvents,
              format: "JSONEachRow",
            });
            console.log(`Inserted ${data.uploadEvents.length} upload events`);
          }

          if (data.downloadEvents.length > 0) {
            await store.insert({
              table: "bahack_downloads",
              values: data.downloadEvents,
              format: "JSONEachRow",
            });
            console.log(
              `Inserted ${data.downloadEvents.length} download events`
            );
          }
        },
        onRollback: async ({ safeCursor, store }) => {
          await store.removeAllRows({
            tables: ["bahack_events", "bahack_downloads"],
            where: `block_number > {latest:UInt64}`,
            params: { latest: safeCursor.number },
          });
        },
      })
    );
}

void main();
