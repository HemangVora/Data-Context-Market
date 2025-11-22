import { createClient } from '@clickhouse/client';
import { evmPortalSource, EvmQueryBuilder, type EvmPortalData } from '@subsquid/pipes/evm';
import { clickhouseTarget } from '@subsquid/pipes/targets/clickhouse';
import { keccak256, toBytes } from 'viem';

// Configuration
const CONFIG = {
  CONTRACT_ADDRESS: process.env.CONTRACT_ADDRESS || "0x87870bca3f3fd6335c3f4ce8392d69350b4fa4e2", // Aave V3 Pool Mainnet
  FROM_BLOCK: parseInt(process.env.FROM_BLOCK || "16291127"), // Aave V3 deployment block
  PORTAL_URL: process.env.PORTAL_URL || "https://portal.sqd.dev/datasets/ethereum-mainnet",

  CLICKHOUSE_URL: process.env.CLICKHOUSE_URL || "http://localhost:8123",
  CLICKHOUSE_USER: process.env.CLICKHOUSE_USER || "default",
  CLICKHOUSE_PASSWORD: process.env.CLICKHOUSE_PASSWORD || "password",
};

// Event signatures
const TOPICS = {
  // Supply(address indexed reserve, address user, address indexed onBehalfOf, uint256 amount, uint16 indexed referralCode)
  Supply: keccak256(toBytes("Supply(address,address,address,uint256,uint16)")),
  // Withdraw(address indexed reserve, address indexed user, address indexed to, uint256 amount)
  Withdraw: keccak256(toBytes("Withdraw(address,address,address,uint256)")),
  // Borrow(address indexed reserve, address user, address indexed onBehalfOf, uint256 amount, uint8 interestRateMode, uint256 borrowRate, uint16 indexed referralCode)
  Borrow: keccak256(toBytes("Borrow(address,address,address,uint256,uint8,uint256,uint16)")),
  // Repay(address indexed reserve, address indexed user, address indexed repayer, uint256 amount, bool useATokens)
  Repay: keccak256(toBytes("Repay(address,address,address,uint256,bool)")),
};

function getEventType(topic0: string): string {
  for (const [name, hash] of Object.entries(TOPICS)) {
    if (topic0 === hash) return name;
  }
  return "Unknown";
}

async function main() {
  console.log('Aave V3 Whale Tracker');
  console.log('Contract:', CONFIG.CONTRACT_ADDRESS);
  console.log('Event signatures:');
  for (const [name, hash] of Object.entries(TOPICS)) {
    console.log(`  ${name}: ${hash}`);
  }

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
          reserve: string;
          user: string;
          amount: string;
          tx_hash: string;
        }> = [];

        for (const block of data.blocks) {
          for (const log of block.logs) {
            try {
              const eventType = getEventType(log.topics[0]);
              let reserve = '';
              let user = '';
              let amount = '0';

              if (eventType === 'Supply') {
                // Supply(address indexed reserve, address user, address indexed onBehalfOf, uint256 amount, uint16 indexed referralCode)
                reserve = '0x' + log.topics[1].slice(26);
                user = '0x' + log.topics[2].slice(26); // onBehalfOf
                const data = log.data.slice(2);
                // user (non-indexed) is first 32 bytes, amount is next 32 bytes
                amount = BigInt('0x' + data.slice(64, 128)).toString();
              } else if (eventType === 'Withdraw') {
                // Withdraw(address indexed reserve, address indexed user, address indexed to, uint256 amount)
                reserve = '0x' + log.topics[1].slice(26);
                user = '0x' + log.topics[2].slice(26);
                const data = log.data.slice(2);
                amount = BigInt('0x' + data.slice(0, 64)).toString();
              } else if (eventType === 'Borrow') {
                // Borrow(address indexed reserve, address user, address indexed onBehalfOf, uint256 amount, uint8 interestRateMode, uint256 borrowRate, uint16 indexed referralCode)
                reserve = '0x' + log.topics[1].slice(26);
                user = '0x' + log.topics[2].slice(26); // onBehalfOf
                const data = log.data.slice(2);
                // user (non-indexed) is first 32 bytes, amount is next 32 bytes
                amount = BigInt('0x' + data.slice(64, 128)).toString();
              } else if (eventType === 'Repay') {
                // Repay(address indexed reserve, address indexed user, address indexed repayer, uint256 amount, bool useATokens)
                reserve = '0x' + log.topics[1].slice(26);
                user = '0x' + log.topics[2].slice(26);
                const data = log.data.slice(2);
                amount = BigInt('0x' + data.slice(0, 64)).toString();
              }

              events.push({
                block_number: block.header.number,
                timestamp: block.header.timestamp,
                event_type: eventType,
                reserve,
                user,
                amount,
                tx_hash: log.transactionHash,
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
              CREATE TABLE IF NOT EXISTS aave_whale_activity (
                block_number  UInt64,
                timestamp     UInt64,
                event_type    String,
                reserve       String,
                user          String,
                amount        String,
                tx_hash       String
              )
              ENGINE = ReplacingMergeTree()
              ORDER BY (block_number, tx_hash, event_type, user)
            `,
          });
          console.log('Table aave_whale_activity created/verified');
        },
        onData: async ({ data, store }) => {
          if (data.length > 0) {
            await store.insert({
              table: 'aave_whale_activity',
              values: data,
              format: 'JSONEachRow',
            });
            console.log(`Inserted ${data.length} whale events`);
          }
        },
        onRollback: async ({ safeCursor, store }) => {
          await store.removeAllRows({
            tables: ['aave_whale_activity'],
            where: `block_number > {latest:UInt64}`,
            params: { latest: safeCursor.number },
          });
        },
      }),
    );
}

void main();
