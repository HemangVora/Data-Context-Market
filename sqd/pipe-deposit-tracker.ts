import { createClient } from '@clickhouse/client';
import { evmPortalSource, EvmQueryBuilder, type EvmPortalData } from '@subsquid/pipes/evm';
import { clickhouseTarget } from '@subsquid/pipes/targets/clickhouse';
import { keccak256, toBytes } from 'viem';

// Configuration
const CONFIG = {
  CONTRACT_ADDRESS: "0xd892de662e18237dfbd080177ba8cec4bc6689e7",
  FROM_BLOCK: 9679658,
  PORTAL_URL: "https://portal.sqd.dev/datasets/ethereum-sepolia",
  CLICKHOUSE_URL: process.env.CLICKHOUSE_URL || "http://localhost:8123",
  CLICKHOUSE_USER: process.env.CLICKHOUSE_USER || "default",
  CLICKHOUSE_PASSWORD: process.env.CLICKHOUSE_PASSWORD || "password",
};

// Event signatures
const TOPICS = {
  CounterIncremented: keccak256(toBytes("CounterIncremented(address,uint256)")),
  Deposit: keccak256(toBytes("Deposit(address,uint256,uint256)")),
  MessageLogged: keccak256(toBytes("MessageLogged(address,string,uint256)")),
  Transfer: keccak256(toBytes("Transfer(address,address,uint256)")),
  Withdrawal: keccak256(toBytes("Withdrawal(address,uint256,uint256)")),
};

function getEventType(topic0: string): string {
  for (const [name, hash] of Object.entries(TOPICS)) {
    if (topic0 === hash) return name;
  }
  return "Unknown";
}

async function main() {
  console.log('Pipe for sepolia_deposits');
  console.log('Contract:', CONFIG.CONTRACT_ADDRESS);
  console.log('Network: sepolia');
  console.log('Events:', Object.keys(TOPICS).join(', '));

  const queryBuilder = new EvmQueryBuilder()
    .addFields({
      block: { number: true, hash: true, timestamp: true },
      log: { address: true, topics: true, data: true, transactionHash: true, logIndex: true },
    })
    .addLog({
      request: {
        address: [CONFIG.CONTRACT_ADDRESS],
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
          tx_hash: string;
          log_index: number;
          data: string;
          topic1: string;
          topic2: string;
          topic3: string;
        }> = [];

        for (const block of data.blocks) {
          for (const log of block.logs) {
            try {
              const eventType = getEventType(log.topics[0]);

              events.push({
                block_number: block.header.number,
                timestamp: block.header.timestamp,
                event_type: eventType,
                tx_hash: log.transactionHash,
                log_index: log.logIndex,
                data: log.data,
                topic1: log.topics[1] ? '0x' + log.topics[1].slice(26) : '',
                topic2: log.topics[2] ? '0x' + log.topics[2].slice(26) : '',
                topic3: log.topics[3] ? '0x' + log.topics[3].slice(26) : '',
              });
            } catch (e) {
              console.error('Failed to decode event:', e);
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
              CREATE TABLE IF NOT EXISTS sepolia_deposits (
                block_number  UInt64,
                timestamp     UInt64,
                event_type    String,
                tx_hash       String,
                log_index     UInt32,
                data          String,
                topic1        String,
                topic2        String,
                topic3        String
              )
              ENGINE = ReplacingMergeTree()
              ORDER BY (block_number, tx_hash, log_index)
            `,
          });
          console.log('Table sepolia_deposits created/verified');
        },
        onData: async ({ data, store }) => {
          if (data.length > 0) {
            await store.insert({
              table: 'sepolia_deposits',
              values: data,
              format: 'JSONEachRow',
            });
            console.log(`Inserted ${data.length} events`);
          }
        },
        onRollback: async ({ safeCursor, store }) => {
          await store.removeAllRows({
            tables: ['sepolia_deposits'],
            where: `block_number > {latest:UInt64}`,
            params: { latest: safeCursor.number },
          });
        },
      }),
    );
}

void main();
