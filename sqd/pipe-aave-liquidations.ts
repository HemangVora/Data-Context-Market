import { createClient } from '@clickhouse/client';
import { evmPortalSource, EvmQueryBuilder, type EvmPortalData } from '@subsquid/pipes/evm';
import { clickhouseTarget } from '@subsquid/pipes/targets/clickhouse';
import { keccak256, toBytes } from 'viem';

// Configuration
const CONFIG = {
  CONTRACT_ADDRESS: process.env.CONTRACT_ADDRESS || "0x87870bca3f3fd6335c3f4ce8392d69350b4fa4e2",
  FROM_BLOCK: parseInt(process.env.FROM_BLOCK || "16291127"),
  PORTAL_URL: process.env.PORTAL_URL || "https://portal.sqd.dev/datasets/ethereum-mainnet",

  CLICKHOUSE_URL: process.env.CLICKHOUSE_URL || "http://localhost:8123",
  CLICKHOUSE_USER: process.env.CLICKHOUSE_USER || "default",
  CLICKHOUSE_PASSWORD: process.env.CLICKHOUSE_PASSWORD || "password",
};

// Token info for human-readable output
const TOKEN_INFO: Record<string, { symbol: string; decimals: number }> = {
  '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2': { symbol: 'WETH', decimals: 18 },
  '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48': { symbol: 'USDC', decimals: 6 },
  '0xdac17f958d2ee523a2206206994597c13d831ec7': { symbol: 'USDT', decimals: 6 },
  '0x6b175474e89094c44da98b954eedeac495271d0f': { symbol: 'DAI', decimals: 18 },
  '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599': { symbol: 'WBTC', decimals: 8 },
  '0x7f39c581f595b53c5cb19bd0b3f8da6c935e2ca0': { symbol: 'wstETH', decimals: 18 },
  '0xae78736cd615f374d3085123a210448e74fc6393': { symbol: 'rETH', decimals: 18 },
  '0x5f98805a4e8be255a32880fdec7f6728c6568ba0': { symbol: 'LUSD', decimals: 18 },
};

const LIQUIDATION_CALL_TOPIC = keccak256(toBytes("LiquidationCall(address,address,address,uint256,uint256,address,bool)"));

// In-memory aggregation
const userStats = new Map<string, {
  liquidation_count: number;
  total_debt: bigint;
  total_collateral_lost: bigint;
  last_block: number;
  assets: Set<string>;
}>();

const liquidatorStats = new Map<string, {
  liquidation_count: number;
  total_seized: bigint;
  users: Set<string>;
}>();

const assetStats = new Map<string, {
  as_collateral: number;
  as_debt: number;
  total_liquidated: bigint;
}>();

function getSymbol(addr: string): string {
  return TOKEN_INFO[addr.toLowerCase()]?.symbol || addr.slice(0, 10);
}

async function main() {
  console.log('Aave V3 Liquidation Analytics');
  console.log('Outputs: User risk profiles, Liquidator stats, Asset metrics');

  const queryBuilder = new EvmQueryBuilder()
    .addFields({
      block: { number: true, hash: true, timestamp: true },
      log: { address: true, topics: true, data: true, transactionHash: true },
    })
    .addLog({
      request: {
        address: [CONFIG.CONTRACT_ADDRESS.toLowerCase()],
        topic0: [LIQUIDATION_CALL_TOPIC],
      },
      range: { from: CONFIG.FROM_BLOCK },
    });

  await evmPortalSource({
    portal: CONFIG.PORTAL_URL,
    query: queryBuilder,
  })
    .pipe({
      transform: (data: EvmPortalData<any>) => {
        let latestTimestamp = 0;

        for (const block of data.blocks) {
          for (const log of block.logs) {
            try {
              const collateralAsset = '0x' + log.topics[1].slice(26);
              const debtAsset = '0x' + log.topics[2].slice(26);
              const user = '0x' + log.topics[3].slice(26);

              const logData = log.data.slice(2);
              const debtToCover = BigInt('0x' + logData.slice(0, 64));
              const collateralAmount = BigInt('0x' + logData.slice(64, 128));
              const liquidator = '0x' + logData.slice(128 + 24, 192);

              latestTimestamp = block.header.timestamp;

              // Aggregate user stats
              if (!userStats.has(user)) {
                userStats.set(user, {
                  liquidation_count: 0,
                  total_debt: 0n,
                  total_collateral_lost: 0n,
                  last_block: 0,
                  assets: new Set(),
                });
              }
              const u = userStats.get(user)!;
              u.liquidation_count++;
              u.total_debt += debtToCover;
              u.total_collateral_lost += collateralAmount;
              u.last_block = block.header.number;
              u.assets.add(getSymbol(collateralAsset));

              // Aggregate liquidator stats
              if (!liquidatorStats.has(liquidator)) {
                liquidatorStats.set(liquidator, {
                  liquidation_count: 0,
                  total_seized: 0n,
                  users: new Set(),
                });
              }
              const l = liquidatorStats.get(liquidator)!;
              l.liquidation_count++;
              l.total_seized += collateralAmount;
              l.users.add(user);

              // Aggregate asset stats
              if (!assetStats.has(collateralAsset)) {
                assetStats.set(collateralAsset, { as_collateral: 0, as_debt: 0, total_liquidated: 0n });
              }
              if (!assetStats.has(debtAsset)) {
                assetStats.set(debtAsset, { as_collateral: 0, as_debt: 0, total_liquidated: 0n });
              }
              assetStats.get(collateralAsset)!.as_collateral++;
              assetStats.get(collateralAsset)!.total_liquidated += collateralAmount;
              assetStats.get(debtAsset)!.as_debt++;

            } catch (e) {
              console.error('Failed to process:', e);
            }
          }
        }

        // Build aggregated outputs
        const userRisk = Array.from(userStats.entries()).map(([user, s]) => {
          const riskScore = Math.min(s.liquidation_count * 20 + s.assets.size * 5, 100);
          return {
            user,
            liquidation_count: s.liquidation_count,
            total_debt_raw: s.total_debt.toString(),
            total_collateral_lost_raw: s.total_collateral_lost.toString(),
            last_block: s.last_block,
            risk_score: riskScore,
            assets_liquidated: Array.from(s.assets).join(','),
            updated_at: latestTimestamp,
          };
        });

        const liquidatorLeaderboard = Array.from(liquidatorStats.entries()).map(([liquidator, s]) => ({
          liquidator,
          liquidation_count: s.liquidation_count,
          total_collateral_seized_raw: s.total_seized.toString(),
          unique_users: s.users.size,
          updated_at: latestTimestamp,
        }));

        const assetRisk = Array.from(assetStats.entries()).map(([asset, s]) => ({
          asset,
          symbol: getSymbol(asset),
          times_as_collateral: s.as_collateral,
          times_as_debt: s.as_debt,
          total_liquidated_raw: s.total_liquidated.toString(),
          risk_ratio: s.as_debt > 0 ? Math.round((s.as_collateral / s.as_debt) * 100) : s.as_collateral * 100,
          updated_at: latestTimestamp,
        }));

        return { userRisk, liquidatorLeaderboard, assetRisk };
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
              CREATE TABLE IF NOT EXISTS aave_user_risk (
                user                      String,
                liquidation_count         UInt32,
                total_debt_raw            String,
                total_collateral_lost_raw String,
                last_block                UInt64,
                risk_score                UInt8,
                assets_liquidated         String,
                updated_at                UInt64
              )
              ENGINE = ReplacingMergeTree(updated_at)
              ORDER BY user
            `,
          });

          await store.command({
            query: `
              CREATE TABLE IF NOT EXISTS aave_liquidator_leaderboard (
                liquidator                  String,
                liquidation_count           UInt32,
                total_collateral_seized_raw String,
                unique_users                UInt32,
                updated_at                  UInt64
              )
              ENGINE = ReplacingMergeTree(updated_at)
              ORDER BY liquidator
            `,
          });

          await store.command({
            query: `
              CREATE TABLE IF NOT EXISTS aave_asset_risk (
                asset               String,
                symbol              String,
                times_as_collateral UInt32,
                times_as_debt       UInt32,
                total_liquidated_raw String,
                risk_ratio          UInt32,
                updated_at          UInt64
              )
              ENGINE = ReplacingMergeTree(updated_at)
              ORDER BY asset
            `,
          });

          console.log('Analytics tables created');
        },
        onData: async ({ data, store }) => {
          if (data.userRisk.length > 0) {
            await store.insert({ table: 'aave_user_risk', values: data.userRisk, format: 'JSONEachRow' });
          }
          if (data.liquidatorLeaderboard.length > 0) {
            await store.insert({ table: 'aave_liquidator_leaderboard', values: data.liquidatorLeaderboard, format: 'JSONEachRow' });
          }
          if (data.assetRisk.length > 0) {
            await store.insert({ table: 'aave_asset_risk', values: data.assetRisk, format: 'JSONEachRow' });
          }

          console.log(`Updated: ${data.userRisk.length} users, ${data.liquidatorLeaderboard.length} liquidators, ${data.assetRisk.length} assets`);
        },
        onRollback: async () => {
          console.log('Rollback - data will rebuild');
        },
      }),
    );
}

void main();
