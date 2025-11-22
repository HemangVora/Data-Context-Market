import { createClient } from '@clickhouse/client';
import { evmPortalSource, EvmQueryBuilder, type EvmPortalData } from '@subsquid/pipes/evm';
import { clickhouseTarget } from '@subsquid/pipes/targets/clickhouse';

// MultiLogger contract
const CONTRACT_ADDRESS = "0x78f99D1412CEf774A8809a28E7f082D7Ce47d648";
const FROM_BLOCK = 9678513;

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
        address: [CONTRACT_ADDRESS.toLowerCase()],
        topic0: Object.values(TOPICS),
      },
      range: { from: FROM_BLOCK },
    });

  await evmPortalSource({
    portal: 'https://portal.sqd.dev/datasets/ethereum-sepolia',
    query: queryBuilder,
  })
    .pipe({
      transform: (data: EvmPortalData<any>) => {
        const events: Array<{
          block_number: number;
          timestamp: number;
          event_type: string;
          topic0: string;
          topic1: string;
          topic2: string;
          data: string;
          tx_hash: string;
        }> = [];

        for (const block of data.blocks) {
          for (const log of block.logs) {
            events.push({
              block_number: block.header.number,
              timestamp: block.header.timestamp,
              event_type: getEventType(log.topics[0]),
              topic0: log.topics[0] || '',
              topic1: log.topics[1] || '',
              topic2: log.topics[2] || '',
              data: log.data,
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
          username: 'default',
          password: 'password',
          url: 'http://localhost:8123',
        }),
        onStart: async ({ store }) => {
          await store.command({
            query: `
              CREATE TABLE IF NOT EXISTS multi_logger_events (
                block_number  UInt64,
                timestamp     UInt64,
                event_type    String,
                topic0        String,
                topic1        String,
                topic2        String,
                data          String,
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
