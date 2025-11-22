import { createClient } from '@clickhouse/client';
import { evmPortalSource, EvmQueryBuilder, type EvmPortalData } from '@subsquid/pipes/evm';
import { clickhouseTarget } from '@subsquid/pipes/targets/clickhouse';

// Configuration - modify these values for your deployment
const CONFIG = {
  // Ethereum Sepolia deployment
  CONTRACT_ADDRESS: process.env.CONTRACT_ADDRESS || "0xd892de662E18237dfBD080177Ba8cEc4bC6689E7",
  FROM_BLOCK: parseInt(process.env.FROM_BLOCK || "9679658"),
  PORTAL_URL: process.env.PORTAL_URL || "https://portal.sqd.dev/datasets/ethereum-sepolia",

  // ClickHouse
  CLICKHOUSE_URL: process.env.CLICKHOUSE_URL || "http://localhost:8123",
  CLICKHOUSE_USER: process.env.CLICKHOUSE_USER || "default",
  CLICKHOUSE_PASSWORD: process.env.CLICKHOUSE_PASSWORD || "password",
};

// Event signatures
const TOPICS = {
  MessageLogged: "0xb5200a0707d2b52d7942fd25f25b70b5015523c0970e541143cc0d82a1320133",
  CounterIncremented: "0x59950fb23669ee30425f6d79758e75fae698a6c88b2982f2980638d8bcd9397d",
  Transfer: "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",
  Deposit: "0x90890809c654f11d6e72a28fa60149770a0d11ec6c92319d6ceb2bb0a4ea1a15",
  Withdrawal: "0xdf273cb619d95419a9cd0ec88123a0538c85064229baa6363788f743fff90deb",
};

function getEventType(topic0: string): string {
  for (const [name, hash] of Object.entries(TOPICS)) {
    if (topic0 === hash) return name;
  }
  return "Unknown";
}

async function main() {
  const queryBuilder = new EvmQueryBuilder()
    .addFields({
      block: { number: true, hash: true, timestamp: true },
      log: { address: true, topics: true, data: true, transactionHash: true },
    })
    .addLog({
      request: {
        address: [CONFIG.CONTRACT_ADDRESS.toLowerCase()],
        topic0: Object.values(TOPICS),
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
          event_type: string;
          sender: string;
          recipient: string;
          amount: string;
          value1: string;
          value2: string;
          tx_hash: string;
        }> = [];

        for (const block of data.blocks) {
          for (const log of block.logs) {
            const eventType = getEventType(log.topics[0]);
            const sender = log.topics[1] ? '0x' + log.topics[1].slice(26) : '';
            const recipient = log.topics[2] ? '0x' + log.topics[2].slice(26) : '';

            // Decode data based on event type
            let amount = '0';
            let value1 = '0';
            let value2 = '0';

            if (log.data && log.data.length > 2) {
              // First 32 bytes (64 hex chars after 0x)
              if (log.data.length >= 66) {
                value1 = BigInt('0x' + log.data.slice(2, 66)).toString();
              }
              // Second 32 bytes
              if (log.data.length >= 130) {
                value2 = BigInt('0x' + log.data.slice(66, 130)).toString();
              }
            }

            // Map values based on event type
            if (eventType === 'CounterIncremented') {
              amount = value1; // newValue
            } else if (eventType === 'Deposit' || eventType === 'Withdrawal') {
              amount = value1; // amount
              // value2 is balance
            } else if (eventType === 'Transfer') {
              amount = value1; // amount
            }

            events.push({
              block_number: block.header.number,
              timestamp: block.header.timestamp,
              event_type: eventType,
              sender,
              recipient,
              amount,
              value1,
              value2,
              tx_hash: log.transactionHash,
            });
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
              CREATE TABLE IF NOT EXISTS multi_logger_events (
                block_number  UInt64,
                timestamp     UInt64,
                event_type    String,
                sender        String,
                recipient     String,
                amount        String,
                value1        String,
                value2        String,
                tx_hash       String
              )
              ENGINE = ReplacingMergeTree()
              ORDER BY (block_number, tx_hash, event_type)
            `,
          });
          console.log('Table multi_logger_events created/verified');
        },
        onData: async ({ data, store }) => {
          if (data.length > 0) {
            await store.insert({
              table: 'multi_logger_events',
              values: data,
              format: 'JSONEachRow',
            });
            console.log(`Inserted ${data.length} events`);
          }
        },
        onRollback: async ({ safeCursor, store }) => {
          await store.removeAllRows({
            tables: ['multi_logger_events'],
            where: `block_number > {latest:UInt64}`,
            params: { latest: safeCursor.number },
          });
        },
      }),
    );
}

void main();
