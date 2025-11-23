import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { spawn, ChildProcess, execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const server = new Server(
  {
    name: "pipes-generator",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Store running pipe processes
const runningPipes: Map<string, ChildProcess> = new Map();

// ClickHouse container management
const CLICKHOUSE_CONTAINER = "pipes-clickhouse";

async function startClickHouse(): Promise<void> {
  try {
    // Check if container exists
    const exists = execSync(`docker ps -a --filter name=${CLICKHOUSE_CONTAINER} --format "{{.Names}}"`, { encoding: "utf-8" }).trim();

    if (exists === CLICKHOUSE_CONTAINER) {
      // Container exists, check if running
      const running = execSync(`docker ps --filter name=${CLICKHOUSE_CONTAINER} --format "{{.Names}}"`, { encoding: "utf-8" }).trim();
      if (running !== CLICKHOUSE_CONTAINER) {
        // Start existing container
        execSync(`docker start ${CLICKHOUSE_CONTAINER}`, { stdio: "ignore" });
      }
    } else {
      // Create and start new container with no password
      execSync(`docker run -d --name ${CLICKHOUSE_CONTAINER} -p 8123:8123 -p 9000:9000 -e CLICKHOUSE_DEFAULT_ACCESS_MANAGEMENT=1 -e CLICKHOUSE_PASSWORD= clickhouse/clickhouse-server`, { stdio: "ignore" });
    }

    // Wait for ClickHouse to be ready
    let retries = 10;
    while (retries > 0) {
      try {
        execSync(`docker exec ${CLICKHOUSE_CONTAINER} clickhouse-client --query "SELECT 1"`, { stdio: "ignore" });
        break;
      } catch {
        retries--;
        await new Promise(r => setTimeout(r, 1000));
      }
    }
    if (retries === 0) {
      throw new Error("ClickHouse failed to start");
    }
  } catch (error: any) {
    throw new Error(`Failed to start ClickHouse: ${error.message}`);
  }
}

function stopClickHouse(): void {
  try {
    execSync(`docker rm -f ${CLICKHOUSE_CONTAINER}`, { stdio: "ignore" });
  } catch {
    // Ignore errors if container doesn't exist
  }
}

// Chain IDs for Etherscan V2 API
const chainIds: Record<string, string> = {
  mainnet: "1",
  goerli: "5",
  sepolia: "11155111",
  polygon: "137",
  arbitrum: "42161",
  optimism: "10",
  base: "8453",
};

// Fetch implementation address for proxy contracts
async function fetchImplementationAddress(contractAddress: string, network: string = "mainnet"): Promise<string | null> {
  const apiKey = process.env.ETHERSCAN_API_KEY || "";
  const chainId = chainIds[network] || chainIds.mainnet;

  const url = `https://api.etherscan.io/v2/api?chainid=${chainId}&module=contract&action=getsourcecode&address=${contractAddress}&apikey=${apiKey}`;

  const response = await fetch(url);
  const data = await response.json() as { status: string; result: any[] };

  if (data.status === "1" && data.result[0]?.Implementation) {
    return data.result[0].Implementation;
  }

  return null;
}

// Fetch ABI from Etherscan (V2 API)
async function fetchABI(contractAddress: string, network: string = "mainnet"): Promise<any> {
  const apiKey = process.env.ETHERSCAN_API_KEY || "";
  const chainId = chainIds[network] || chainIds.mainnet;

  // First try to get the ABI directly
  let url = `https://api.etherscan.io/v2/api?chainid=${chainId}&module=contract&action=getabi&address=${contractAddress}&apikey=${apiKey}`;
  let response = await fetch(url);
  let data = await response.json() as { status: string; message?: string; result: string };

  if (data.status !== "1") {
    throw new Error(`Failed to fetch ABI: ${data.message || data.result}`);
  }

  let abi = JSON.parse(data.result);

  // Check if this looks like a proxy (only has Upgraded event or very few events)
  const events = abi.filter((item: any) => item.type === "event");
  if (events.length <= 2 && events.some((e: any) => e.name === "Upgraded" || e.name === "AdminChanged")) {
    // Try to fetch implementation ABI
    const implAddress = await fetchImplementationAddress(contractAddress, network);
    if (implAddress) {
      url = `https://api.etherscan.io/v2/api?chainid=${chainId}&module=contract&action=getabi&address=${implAddress}&apikey=${apiKey}`;
      response = await fetch(url);
      data = await response.json() as { status: string; message?: string; result: string };

      if (data.status === "1") {
        abi = JSON.parse(data.result);
      }
    }
  }

  return abi;
}

// Extract events from ABI
function extractEvents(abi: any[]): any[] {
  return abi.filter((item) => item.type === "event");
}

// Generate event signature
function generateEventSignature(event: any): string {
  // Use custom signature if provided (for proxy contracts)
  if (event._customSignature) {
    return event._customSignature;
  }
  const inputs = event.inputs.map((input: any) => input.type).join(",");
  return `${event.name}(${inputs})`;
}

// Filter configuration types
interface FilterConfig {
  minAmount?: string; // Minimum amount in wei or token units
  maxAmount?: string; // Maximum amount
  decimals?: number;  // Token decimals for amount parsing
  addresses?: string[]; // Filter by specific addresses
  excludeAddresses?: string[]; // Exclude specific addresses
}

// Generate pipe code
function generatePipeCode(
  contractAddress: string,
  events: any[],
  tableName: string,
  network: string,
  fromBlock: number,
  filters?: FilterConfig
): string {
  const portalUrls: Record<string, string> = {
    mainnet: "https://portal.sqd.dev/datasets/ethereum-mainnet",
    goerli: "https://portal.sqd.dev/datasets/ethereum-goerli",
    sepolia: "https://portal.sqd.dev/datasets/ethereum-sepolia",
    polygon: "https://portal.sqd.dev/datasets/polygon-mainnet",
    arbitrum: "https://portal.sqd.dev/datasets/arbitrum-mainnet",
    optimism: "https://portal.sqd.dev/datasets/optimism-mainnet",
    base: "https://portal.sqd.dev/datasets/base-mainnet",
  };

  const portalUrl = portalUrls[network] || portalUrls.mainnet;

  // Generate topic hashes
  const topicsCode = events
    .map((e) => {
      const sig = generateEventSignature(e);
      return `  ${e.name}: keccak256(toBytes("${sig}")),`;
    })
    .join("\n");

  // Generate event structure documentation
  const eventDocs = events
    .map((e) => {
      const indexed = e.inputs?.filter((i: any) => i.indexed) || [];
      const nonIndexed = e.inputs?.filter((i: any) => !i.indexed) || [];
      let doc = `// ${e.name}:\n`;
      doc += `//   Indexed (topics): ${indexed.map((i: any) => `${i.name}(${i.type})`).join(', ') || 'none'}\n`;
      doc += `//   Non-indexed (data): ${nonIndexed.map((i: any) => `${i.name}(${i.type})`).join(', ') || 'none'}`;
      return doc;
    })
    .join("\n");

  // Generate event-specific amount position map
  // Find the position of uint256 fields named "amount" or similar in the non-indexed data
  const amountPositions: Record<string, number> = {};
  events.forEach((e) => {
    const nonIndexed = e.inputs?.filter((i: any) => !i.indexed) || [];
    let position = 0;
    for (const input of nonIndexed) {
      if (input.type === 'uint256' && (input.name === 'amount' || input.name === 'value' || input.name === 'borrowRate' || input.name.toLowerCase().includes('amount'))) {
        amountPositions[e.name] = position;
        break;
      }
      position++;
    }
    // Default to 0 if no amount field found
    if (amountPositions[e.name] === undefined) {
      amountPositions[e.name] = 0;
    }
  });

  const amountPositionCode = `const AMOUNT_POSITIONS: Record<string, number> = ${JSON.stringify(amountPositions, null, 2)};`;

  // Generate filter code based on configuration
  const generateFilterCode = (filters?: FilterConfig): string => {
    if (!filters) return '';

    const filterLines: string[] = [];

    if (filters.minAmount) {
      filterLines.push(`
              // Whale filter: minimum amount using event-specific position
              const filterAmountPosition = AMOUNT_POSITIONS[eventType] ?? 0;
              const filterAmount = decodeAmount(log.data, filterAmountPosition);
              const minAmount = BigInt("${filters.minAmount}");
              if (filterAmount < minAmount) continue;`);
    }

    if (filters.maxAmount) {
      filterLines.push(`
              // Maximum amount filter using event-specific position
              const maxFilterAmountPosition = AMOUNT_POSITIONS[eventType] ?? 0;
              const maxFilterAmount = decodeAmount(log.data, maxFilterAmountPosition);
              const maxAmount = BigInt("${filters.maxAmount}");
              if (maxFilterAmount > maxAmount) continue;`);
    }

    if (filters.addresses && filters.addresses.length > 0) {
      const addrList = filters.addresses.map(a => `"${a.toLowerCase()}"`).join(', ');
      filterLines.push(`
              // Address whitelist filter
              const allowedAddresses = new Set([${addrList}]);
              const fromAddr = log.topics[1] ? '0x' + log.topics[1].slice(26).toLowerCase() : '';
              const toAddr = log.topics[2] ? '0x' + log.topics[2].slice(26).toLowerCase() : '';
              if (!allowedAddresses.has(fromAddr) && !allowedAddresses.has(toAddr)) continue;`);
    }

    if (filters.excludeAddresses && filters.excludeAddresses.length > 0) {
      const excludeList = filters.excludeAddresses.map(a => `"${a.toLowerCase()}"`).join(', ');
      filterLines.push(`
              // Address blacklist filter
              const excludedAddresses = new Set([${excludeList}]);
              const fromAddrExcl = log.topics[1] ? '0x' + log.topics[1].slice(26).toLowerCase() : '';
              const toAddrExcl = log.topics[2] ? '0x' + log.topics[2].slice(26).toLowerCase() : '';
              if (excludedAddresses.has(fromAddrExcl) || excludedAddresses.has(toAddrExcl)) continue;`);
    }

    return filterLines.join('\n');
  };

  const filterCode = generateFilterCode(filters);
  const filterComment = filters ? `
// Active filters:
${filters.minAmount ? `//   - Min amount: ${filters.minAmount} (decimals: ${filters.decimals || 18})` : ''}
${filters.maxAmount ? `//   - Max amount: ${filters.maxAmount}` : ''}
${filters.addresses ? `//   - Address whitelist: ${filters.addresses.length} addresses` : ''}
${filters.excludeAddresses ? `//   - Address blacklist: ${filters.excludeAddresses.length} addresses` : ''}
` : '';

  return `import { createClient } from '@clickhouse/client';
import { evmPortalSource, EvmQueryBuilder, type EvmPortalData } from '@subsquid/pipes/evm';
import { clickhouseTarget } from '@subsquid/pipes/targets/clickhouse';
import { keccak256, toBytes, formatUnits, parseUnits } from 'viem';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const CONFIG = {
  CONTRACT_ADDRESS: "${contractAddress.toLowerCase()}",
  FROM_BLOCK: ${fromBlock},
  PORTAL_URL: "${portalUrl}",
  OUTPUT_DIR: path.join(__dirname, 'output'),
  CSV_FILE: '${tableName}.csv',
  TABLE_NAME: '${tableName}',
  CLICKHOUSE_URL: 'http://localhost:8123',
  DECIMALS: ${filters?.decimals || 18},
};

// Event signatures
const TOPICS = {
${topicsCode}
};

// Event structure reference:
${eventDocs}

// Amount position in data for each event type (0-indexed 32-byte slots)
${amountPositionCode}
${filterComment}
function getEventType(topic0: string): string {
  for (const [name, hash] of Object.entries(TOPICS)) {
    if (topic0 === hash) return name;
  }
  return "Unknown";
}

// Helper to decode amount from log data
function decodeAmount(data: string, position: number = 0): bigint {
  const cleanData = data.startsWith('0x') ? data.slice(2) : data;
  const start = position * 64;
  if (cleanData.length < start + 64) return 0n;
  return BigInt('0x' + cleanData.slice(start, start + 64));
}

// Helper to format amount with decimals
function formatAmount(amount: bigint, decimals: number = CONFIG.DECIMALS): string {
  return formatUnits(amount, decimals);
}

async function main() {
  console.log('Pipe for ${tableName}');
  console.log('Contract:', CONFIG.CONTRACT_ADDRESS);
  console.log('Network: ${network}');
  console.log('Events:', Object.keys(TOPICS).join(', '));
  ${filters?.minAmount ? `console.log('Min amount filter:', "${filters.minAmount}");` : ''}

  // Create output directory if it doesn't exist
  if (!fs.existsSync(CONFIG.OUTPUT_DIR)) {
    fs.mkdirSync(CONFIG.OUTPUT_DIR, { recursive: true });
  }

  const csvPath = path.join(CONFIG.OUTPUT_DIR, CONFIG.CSV_FILE);

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

  let totalProcessed = 0;
  let totalFiltered = 0;

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
          amount: string;
          amount_formatted: string;
          from_address: string;
          to_address: string;
          topic3: string;
        }> = [];

        for (const block of data.blocks) {
          for (const log of block.logs) {
            try {
              const eventType = getEventType(log.topics[0]);
              totalProcessed++;
${filterCode}

              // Decode amount from data using event-specific position
              const amountPosition = AMOUNT_POSITIONS[eventType] ?? 0;
              const amount = decodeAmount(log.data, amountPosition);
              const amountFormatted = formatAmount(amount);

              events.push({
                block_number: block.header.number,
                timestamp: block.header.timestamp,
                event_type: eventType,
                tx_hash: log.transactionHash,
                log_index: log.logIndex,
                data: log.data,
                amount: amount.toString(),
                amount_formatted: amountFormatted,
                from_address: log.topics[1] ? '0x' + log.topics[1].slice(26) : '',
                to_address: log.topics[2] ? '0x' + log.topics[2].slice(26) : '',
                topic3: log.topics[3] ? '0x' + log.topics[3].slice(26) : '',
              });
            } catch (e) {
              console.error('Failed to decode event:', e);
            }
          }
        }

        totalFiltered += events.length;
        return events;
      },
    })
    .pipeTo(
      clickhouseTarget({
        client: createClient({
          url: CONFIG.CLICKHOUSE_URL,
          username: 'default',
          password: '',
        }),
        onStart: async ({ store }) => {
          await store.command({
            query: \`
              CREATE TABLE IF NOT EXISTS \${CONFIG.TABLE_NAME} (
                block_number     UInt64,
                timestamp        UInt64,
                event_type       String,
                tx_hash          String,
                log_index        UInt32,
                data             String,
                amount           String,
                amount_formatted String,
                from_address     String,
                to_address       String,
                topic3           String
              )
              ENGINE = ReplacingMergeTree()
              ORDER BY (block_number, log_index)
            \`,
          });
          console.log(\`Created table \${CONFIG.TABLE_NAME}\`);
        },
        onData: async ({ data, store }) => {
          if (data.length === 0) return;

          // Insert to ClickHouse
          await store.insert({
            table: CONFIG.TABLE_NAME,
            values: data,
            format: 'JSONEachRow',
          });

          // Also write to CSV
          const fileExists = fs.existsSync(csvPath);
          const headers = ['block_number', 'timestamp', 'event_type', 'tx_hash', 'log_index', 'data', 'amount', 'amount_formatted', 'from_address', 'to_address', 'topic3'];

          const rows = data.map(e =>
            [e.block_number, e.timestamp, e.event_type, e.tx_hash, e.log_index, e.data, e.amount, e.amount_formatted, e.from_address, e.to_address, e.topic3]
              .map(v => \`"\${String(v).replace(/"/g, '""')}"\`)
              .join(',')
          );

          let content = '';
          if (!fileExists) {
            content = headers.join(',') + '\\n';
            console.log(\`Creating CSV file: \${csvPath}\`);
          }
          content += rows.join('\\n') + '\\n';

          fs.appendFileSync(csvPath, content);
          console.log(\`Processed \${data.length} events | Total: \${totalFiltered}/\${totalProcessed} (filtered/processed)\`);
        },
        onRollback: async ({ safeCursor, store }) => {
          await store.removeAllRows({
            tables: [CONFIG.TABLE_NAME],
            where: \`block_number > {latest:UInt64}\`,
            params: { latest: safeCursor.number },
          });
        },
      })
    );

  console.log('Indexing complete!');
  console.log(\`Final stats: \${totalFiltered} events kept out of \${totalProcessed} processed\`);
}

void main();

// Docs: https://docs.sqd.dev/sdk/pipes-sdk/quickstart
`;
}

// Tool handlers
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "generate_pipe",
        description:
          "Generate a Subsquid pipe for indexing blockchain events with optional filtering (whale detection, address filtering). Fetches ABI from Etherscan and creates pipe code. Use get_contract_events first to see available events. Supports filtering by amount (for whale tracking), address whitelist/blacklist. CRITICAL: You MUST display the COMPLETE ABSOLUTE file paths returned by this tool.",
        inputSchema: {
          type: "object",
          properties: {
            contractAddress: {
              type: "string",
              description: "The smart contract address to index",
            },
            network: {
              type: "string",
              description:
                "Network: mainnet, sepolia, polygon, arbitrum, optimism, base",
              default: "mainnet",
            },
            tableName: {
              type: "string",
              description: "Name for the ClickHouse table and CSV file",
            },
            fromBlock: {
              type: "number",
              description: "Starting block number (use contract deployment block for efficiency)",
              default: 0,
            },
            outputFile: {
              type: "string",
              description: "Output filename (e.g., pipe-aave.ts)",
            },
            events: {
              type: "array",
              items: { type: "string" },
              description: "Specific event names to index (e.g., ['LiquidationCall', 'Supply']). If omitted, indexes all events.",
            },
            customEvents: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  signature: { type: "string" },
                },
              },
              description: "Custom event signatures for proxy contracts (e.g., [{name: 'LiquidationCall', signature: 'LiquidationCall(address,address,address,uint256,uint256,address,bool)'}]). Use when ABI doesn't contain the events.",
            },
            filters: {
              type: "object",
              description: "Filter configuration for whale tracking and address filtering",
              properties: {
                minAmount: {
                  type: "string",
                  description: "Minimum amount in wei/token units (e.g., '100000000000000000000' for 100 tokens with 18 decimals, or '100000000' for 100 USDC with 6 decimals). Use this for whale filtering.",
                },
                maxAmount: {
                  type: "string",
                  description: "Maximum amount in wei/token units",
                },
                decimals: {
                  type: "number",
                  description: "Token decimals for amount formatting (default: 18, use 6 for USDC/USDT)",
                  default: 18,
                },
                addresses: {
                  type: "array",
                  items: { type: "string" },
                  description: "Whitelist: only include events involving these addresses",
                },
                excludeAddresses: {
                  type: "array",
                  items: { type: "string" },
                  description: "Blacklist: exclude events involving these addresses (e.g., known contracts, bots)",
                },
              },
            },
          },
          required: ["contractAddress", "tableName", "outputFile"],
        },
      },
      {
        name: "run_pipe",
        description: "Run a generated pipe script. CRITICAL: You MUST display the COMPLETE ABSOLUTE file paths (starting with /) for the pipe, CSV, and URLs returned by this tool. NEVER shorten paths - always show full paths like '/Users/.../mcp-sqd/output/file.csv'. This is essential for the user to locate and use the files.",
        inputSchema: {
          type: "object",
          properties: {
            pipeFile: {
              type: "string",
              description: "Path to the pipe file to run",
            },
          },
          required: ["pipeFile"],
        },
      },
      {
        name: "stop_pipe",
        description: "Stop a running pipe",
        inputSchema: {
          type: "object",
          properties: {
            pipeFile: {
              type: "string",
              description: "Path to the pipe file to stop",
            },
          },
          required: ["pipeFile"],
        },
      },
      {
        name: "list_running_pipes",
        description: "List all currently running pipes",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "get_contract_events",
        description:
          "Fetch and list all events from a contract's ABI. Use this first to understand the contract's events before generating a pipe. Shows event names, signatures, and parameter details (indexed params become topics, non-indexed go in data).",
        inputSchema: {
          type: "object",
          properties: {
            contractAddress: {
              type: "string",
              description: "The smart contract address",
            },
            network: {
              type: "string",
              description: "Network: mainnet, sepolia, polygon, arbitrum, optimism, base",
              default: "mainnet",
            },
          },
          required: ["contractAddress"],
        },
      },
      {
        name: "analyze_csv",
        description:
          "Analyze a CSV file generated by a pipe. Perform data cleaning, aggregations, and analytics. Results are saved as a new CSV in the output folder. CRITICAL: You MUST display the COMPLETE ABSOLUTE file paths (starting with /) for input and output files. NEVER shorten paths.",
        inputSchema: {
          type: "object",
          properties: {
            csvPath: {
              type: "string",
              description: "Path to the CSV file to analyze (full path or filename in output folder)",
            },
            operations: {
              type: "array",
              items: { type: "string" },
              description: "Operations: 'count_by_event', 'count_by_address', 'top_addresses', 'net_flow', 'remove_duplicates', 'filter_empty', 'summary'",
            },
          },
          required: ["csvPath", "operations"],
        },
      },
      {
        name: "aggregate_csv",
        description:
          "Flexible aggregation tool for CSV data. Group by any column and apply aggregation functions (sum, count, avg, min, max) to other columns. Perfect for custom analytics like 'sum amount by wallet' or 'count transactions by event type'.",
        inputSchema: {
          type: "object",
          properties: {
            csvPath: {
              type: "string",
              description: "Path to the CSV file (full path or filename in output folder)",
            },
            groupBy: {
              type: "string",
              description: "Column to group by (e.g., 'from_address', 'event_type', 'to_address')",
            },
            aggregations: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  column: { type: "string", description: "Column to aggregate" },
                  function: { type: "string", enum: ["sum", "count", "avg", "min", "max"], description: "Aggregation function" },
                  alias: { type: "string", description: "Output column name (optional)" },
                },
                required: ["column", "function"],
              },
              description: "List of aggregations to perform. E.g., [{column: 'amount', function: 'sum', alias: 'total_amount'}]",
            },
            sortBy: {
              type: "string",
              description: "Column to sort results by (optional)",
            },
            sortOrder: {
              type: "string",
              enum: ["asc", "desc"],
              description: "Sort order (default: desc)",
              default: "desc",
            },
            limit: {
              type: "number",
              description: "Limit number of results (default: 100)",
              default: 100,
            },
          },
          required: ["csvPath", "groupBy", "aggregations"],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "generate_pipe": {
        const {
          contractAddress,
          network = "mainnet",
          tableName: baseTableName,
          fromBlock = 0,
          outputFile: baseOutputFile,
          events: eventFilter,
          customEvents,
          filters,
        } = args as any;

        // Add timestamp to avoid conflicts with existing pipes
        const timestamp = Date.now();
        const tableName = `${baseTableName}_${timestamp}`;
        const outputFile = baseOutputFile.replace('.ts', `_${timestamp}.ts`);

        let events: any[] = [];

        // Use custom events if provided (for proxy contracts)
        if (customEvents && Array.isArray(customEvents) && customEvents.length > 0) {
          events = customEvents.map((ce: any) => ({
            name: ce.name,
            inputs: [], // We don't need inputs for signature-based generation
            _customSignature: ce.signature,
          }));
        } else {
          // Fetch ABI from Etherscan
          const abi = await fetchABI(contractAddress, network);
          events = extractEvents(abi);

          if (events.length === 0) {
            return {
              content: [
                {
                  type: "text",
                  text: `No events found in contract ${contractAddress}. For proxy contracts, use customEvents parameter with event signatures.`,
                },
              ],
            };
          }

          // Filter events if specified
          if (eventFilter && Array.isArray(eventFilter) && eventFilter.length > 0) {
            const filtered = events.filter((e) => eventFilter.includes(e.name));
            if (filtered.length === 0) {
              const available = events.map((e) => e.name).join(", ");
              return {
                content: [
                  {
                    type: "text",
                    text: `None of the specified events found. Available: ${available}\n\nFor proxy contracts, use customEvents parameter.`,
                  },
                ],
              };
            }
            events = filtered;
          }
        }

        // Generate pipe code
        const code = generatePipeCode(
          contractAddress,
          events,
          tableName,
          network,
          fromBlock,
          filters
        );

        // Write to file
        const outputPath = path.resolve(__dirname, outputFile);
        fs.writeFileSync(outputPath, code);

        const eventList = events.map((e) => e.name).join(", ");
        const outputDir = path.join(__dirname, 'output');
        const csvPath = path.join(outputDir, `${tableName}.csv`);
        const csvUrl = `file://${csvPath}`;
        const pipeUrl = `file://${outputPath}`;

        // Build filter description
        let filterDesc = '';
        if (filters) {
          const filterParts: string[] = [];
          if (filters.minAmount) filterParts.push(`Min amount: ${filters.minAmount} (${filters.decimals || 18} decimals)`);
          if (filters.maxAmount) filterParts.push(`Max amount: ${filters.maxAmount}`);
          if (filters.addresses) filterParts.push(`Address whitelist: ${filters.addresses.length} addresses`);
          if (filters.excludeAddresses) filterParts.push(`Address blacklist: ${filters.excludeAddresses.length} addresses`);
          if (filterParts.length > 0) {
            filterDesc = `\n\nFilters applied:\n- ${filterParts.join('\n- ')}`;
          }
        }

        return {
          content: [
            {
              type: "text",
              text: `Successfully generated pipe at ${outputPath}\n- Pipe URL: ${pipeUrl}\n\nEvents indexed: ${eventList}${filterDesc}\n\nOutput will be saved to:\n- CSV: ${csvPath}\n- CSV URL: ${csvUrl}\n- ClickHouse table: ${tableName}\n\nTo run: use run_pipe tool with pipeFile="${outputFile}"`,
            },
          ],
        };
      }

      case "run_pipe": {
        const { pipeFile } = args as any;
        const pipePath = path.resolve(__dirname, pipeFile);

        if (!fs.existsSync(pipePath)) {
          return {
            content: [
              {
                type: "text",
                text: `Pipe file not found: ${pipePath}`,
              },
            ],
          };
        }

        if (runningPipes.has(pipeFile)) {
          return {
            content: [
              {
                type: "text",
                text: `Pipe ${pipeFile} is already running`,
              },
            ],
          };
        }

        // Start ClickHouse container
        try {
          await startClickHouse();
        } catch (error: any) {
          return {
            content: [
              {
                type: "text",
                text: `Failed to start ClickHouse: ${error.message}`,
              },
            ],
            isError: true,
          };
        }

        const child = spawn("npx", ["tsx", pipePath], {
          cwd: __dirname,
          stdio: ["ignore", "pipe", "pipe"],
        });

        let output = "";
        child.stdout?.on("data", (data) => {
          output += data.toString();
        });
        child.stderr?.on("data", (data) => {
          output += data.toString();
        });

        child.on("exit", (code) => {
          runningPipes.delete(pipeFile);
          // Stop ClickHouse when pipe exits and no other pipes are running
          if (runningPipes.size === 0) {
            stopClickHouse();
            console.error(`Pipe ${pipeFile} completed (exit code: ${code}). ClickHouse stopped.`);
          }
        });

        runningPipes.set(pipeFile, child);

        // Wait a bit for initial output
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Extract table name from pipe file to show output path
        const pipeContent = fs.readFileSync(pipePath, 'utf-8');
        const tableMatch = pipeContent.match(/TABLE_NAME:\s*['"]([^'"]+)['"]/);
        const tableName = tableMatch ? tableMatch[1] : pipeFile.replace('.ts', '');
        const outputDir = path.join(__dirname, 'output');
        const csvPath = path.join(outputDir, `${tableName}.csv`);
        const csvUrl = `file://${csvPath}`;
        const pipeUrl = `file://${pipePath}`;

        return {
          content: [
            {
              type: "text",
              text: `Started pipe ${pipeFile} (PID: ${child.pid})\n- Pipe: ${pipePath}\n- Pipe URL: ${pipeUrl}\n\nClickHouse container started automatically.\n\nOutput files:\n- CSV: ${csvPath}\n- CSV URL: ${csvUrl}\n- ClickHouse table: ${tableName}\n\nInitial output:\n${output || "(waiting for output...)"}`,
            },
          ],
        };
      }

      case "stop_pipe": {
        const { pipeFile } = args as any;

        const child = runningPipes.get(pipeFile);
        if (!child) {
          return {
            content: [
              {
                type: "text",
                text: `No running pipe found: ${pipeFile}`,
              },
            ],
          };
        }

        child.kill("SIGTERM");
        runningPipes.delete(pipeFile);

        // Stop ClickHouse if no other pipes are running
        let clickhouseStopped = false;
        if (runningPipes.size === 0) {
          stopClickHouse();
          clickhouseStopped = true;
        }

        return {
          content: [
            {
              type: "text",
              text: `Stopped pipe ${pipeFile}${clickhouseStopped ? "\nClickHouse container stopped." : ""}`,
            },
          ],
        };
      }

      case "list_running_pipes": {
        const pipes = Array.from(runningPipes.keys());

        if (pipes.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: "No pipes currently running",
              },
            ],
          };
        }

        return {
          content: [
            {
              type: "text",
              text: `Running pipes:\n${pipes.map((p) => `- ${p}`).join("\n")}`,
            },
          ],
        };
      }

      case "get_contract_events": {
        const { contractAddress, network = "mainnet" } = args as any;

        const abi = await fetchABI(contractAddress, network);
        const events = extractEvents(abi);

        if (events.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: `No events found in contract ${contractAddress}`,
              },
            ],
          };
        }

        const eventInfo = events
          .map((e) => {
            const sig = generateEventSignature(e);
            const inputs = e.inputs
              .map(
                (i: any) =>
                  `  - ${i.name}: ${i.type}${i.indexed ? " (indexed)" : ""}`
              )
              .join("\n");
            return `${e.name}\n  Signature: ${sig}\n  Inputs:\n${inputs}`;
          })
          .join("\n\n");

        return {
          content: [
            {
              type: "text",
              text: `Events in contract ${contractAddress}:\n\n${eventInfo}`,
            },
          ],
        };
      }

      case "analyze_csv": {
        const { csvPath, operations } = args as any;

        // Resolve CSV path
        let resolvedPath = csvPath;
        if (!path.isAbsolute(csvPath)) {
          resolvedPath = path.join(__dirname, 'output', csvPath);
        }

        if (!fs.existsSync(resolvedPath)) {
          return {
            content: [
              {
                type: "text",
                text: `CSV file not found: ${resolvedPath}`,
              },
            ],
          };
        }

        // Read and parse CSV
        const csvContent = fs.readFileSync(resolvedPath, 'utf-8');
        const lines = csvContent.split('\n').filter(line => line.trim());
        if (lines.length < 2) {
          return {
            content: [
              {
                type: "text",
                text: `CSV file is empty or has no data rows`,
              },
            ],
          };
        }

        const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
        const rows = lines.slice(1).map(line => {
          const values = line.match(/(".*?"|[^,]+)/g) || [];
          const row: Record<string, string> = {};
          headers.forEach((h, i) => {
            row[h] = values[i]?.replace(/"/g, '').trim() || '';
          });
          return row;
        });

        const results: Record<string, any> = {};
        const outputRows: any[] = [];

        for (const op of operations) {
          switch (op) {
            case 'summary':
              results.summary = {
                total_rows: rows.length,
                columns: headers,
                event_types: [...new Set(rows.map(r => r.event_type))],
              };
              break;

            case 'count_by_event':
              const eventCounts: Record<string, number> = {};
              rows.forEach(r => {
                eventCounts[r.event_type] = (eventCounts[r.event_type] || 0) + 1;
              });
              results.count_by_event = eventCounts;
              Object.entries(eventCounts).forEach(([event, count]) => {
                outputRows.push({ analysis_type: 'count_by_event', key: event, value: count });
              });
              break;

            case 'count_by_address':
              const addressCounts: Record<string, number> = {};
              rows.forEach(r => {
                const addr = r.topic1 || 'unknown';
                addressCounts[addr] = (addressCounts[addr] || 0) + 1;
              });
              results.count_by_address = addressCounts;
              Object.entries(addressCounts).forEach(([addr, count]) => {
                outputRows.push({ analysis_type: 'count_by_address', key: addr, value: count });
              });
              break;

            case 'top_addresses':
              const addrCounts: Record<string, number> = {};
              rows.forEach(r => {
                const addr = r.topic1 || 'unknown';
                addrCounts[addr] = (addrCounts[addr] || 0) + 1;
              });
              const topAddrs = Object.entries(addrCounts)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 10);
              results.top_addresses = topAddrs.map(([addr, count]) => ({ address: addr, count }));
              topAddrs.forEach(([addr, count], i) => {
                outputRows.push({ analysis_type: 'top_addresses', rank: i + 1, address: addr, count });
              });
              break;

            case 'net_flow':
              const flows: Record<string, { deposits: number; withdrawals: number }> = {};
              rows.forEach(r => {
                const addr = r.topic1 || 'unknown';
                if (!flows[addr]) flows[addr] = { deposits: 0, withdrawals: 0 };
                const eventType = r.event_type?.toLowerCase() || '';
                if (eventType.includes('supply') || eventType.includes('deposit')) {
                  flows[addr].deposits += 1;
                } else if (eventType.includes('withdraw')) {
                  flows[addr].withdrawals += 1;
                }
              });
              const netFlows = Object.entries(flows)
                .map(([addr, f]) => ({
                  address: addr,
                  deposits: f.deposits,
                  withdrawals: f.withdrawals,
                  net_flow: f.deposits - f.withdrawals,
                }))
                .sort((a, b) => b.net_flow - a.net_flow);
              results.net_flow = netFlows.slice(0, 20);
              netFlows.slice(0, 20).forEach(f => {
                outputRows.push({ analysis_type: 'net_flow', ...f });
              });
              break;

            case 'remove_duplicates':
              const seen = new Set<string>();
              const uniqueRows = rows.filter(r => {
                const key = `${r.tx_hash}-${r.log_index}`;
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
              });
              results.remove_duplicates = {
                original: rows.length,
                after: uniqueRows.length,
                removed: rows.length - uniqueRows.length,
              };
              break;

            case 'filter_empty':
              const nonEmpty = rows.filter(r => r.data && r.data.trim() !== '');
              results.filter_empty = {
                original: rows.length,
                after: nonEmpty.length,
                removed: rows.length - nonEmpty.length,
              };
              break;
          }
        }

        // Generate output CSV
        const timestamp = Date.now();
        const baseName = path.basename(resolvedPath, '.csv');
        const outputFileName = `${baseName}_analysis_${timestamp}.csv`;
        const outputPath = path.join(__dirname, 'output', outputFileName);

        if (outputRows.length > 0) {
          const outputHeaders = Object.keys(outputRows[0]);
          const csvLines = [
            outputHeaders.join(','),
            ...outputRows.map(row =>
              outputHeaders.map(h => `"${String(row[h] || '').replace(/"/g, '""')}"`).join(',')
            )
          ];
          fs.writeFileSync(outputPath, csvLines.join('\n'));
        }

        const outputUrl = `file://${outputPath}`;

        return {
          content: [
            {
              type: "text",
              text: `Analysis complete!\n\nInput: ${resolvedPath}\nOutput: ${outputPath}\nOutput URL: ${outputUrl}\n\nResults:\n${JSON.stringify(results, null, 2)}`,
            },
          ],
        };
      }

      case "aggregate_csv": {
        const { csvPath, groupBy, aggregations, sortBy, sortOrder = "desc", limit = 100 } = args as any;

        // Resolve CSV path
        let resolvedPath = csvPath;
        if (!path.isAbsolute(csvPath)) {
          resolvedPath = path.join(__dirname, 'output', csvPath);
        }

        if (!fs.existsSync(resolvedPath)) {
          return {
            content: [
              {
                type: "text",
                text: `CSV file not found: ${resolvedPath}`,
              },
            ],
          };
        }

        // Read and parse CSV
        const csvContent = fs.readFileSync(resolvedPath, 'utf-8');
        const lines = csvContent.split('\n').filter(line => line.trim());
        if (lines.length < 2) {
          return {
            content: [
              {
                type: "text",
                text: `CSV file is empty or has no data rows`,
              },
            ],
          };
        }

        const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
        const rows = lines.slice(1).map(line => {
          const values = line.match(/(".*?"|[^,]+)/g) || [];
          const row: Record<string, string> = {};
          headers.forEach((h, i) => {
            row[h] = values[i]?.replace(/"/g, '').trim() || '';
          });
          return row;
        });

        // Validate groupBy column exists
        if (!headers.includes(groupBy)) {
          return {
            content: [
              {
                type: "text",
                text: `Column '${groupBy}' not found. Available columns: ${headers.join(', ')}`,
              },
            ],
          };
        }

        // Perform aggregation
        const groups: Record<string, any[]> = {};
        rows.forEach(row => {
          const key = row[groupBy] || 'unknown';
          if (!groups[key]) groups[key] = [];
          groups[key].push(row);
        });

        // Calculate aggregations for each group
        const results = Object.entries(groups).map(([groupKey, groupRows]) => {
          const result: Record<string, any> = { [groupBy]: groupKey };

          for (const agg of aggregations) {
            const { column, function: fn, alias } = agg;
            const outputName = alias || `${fn}_${column}`;
            const values = groupRows.map(r => r[column]).filter(v => v !== '');

            switch (fn) {
              case 'sum':
                // Handle both numeric and bigint values
                try {
                  const sum = values.reduce((acc, v) => {
                    const num = BigInt(v || '0');
                    return acc + num;
                  }, 0n);
                  result[outputName] = sum.toString();
                } catch {
                  result[outputName] = values.reduce((acc, v) => acc + parseFloat(v || '0'), 0).toString();
                }
                break;
              case 'count':
                result[outputName] = values.length;
                break;
              case 'avg':
                try {
                  const sum = values.reduce((acc, v) => acc + BigInt(v || '0'), 0n);
                  result[outputName] = values.length > 0 ? (sum / BigInt(values.length)).toString() : '0';
                } catch {
                  const sum = values.reduce((acc, v) => acc + parseFloat(v || '0'), 0);
                  result[outputName] = values.length > 0 ? (sum / values.length).toString() : '0';
                }
                break;
              case 'min':
                try {
                  const min = values.reduce((acc, v) => {
                    const num = BigInt(v || '0');
                    return num < acc ? num : acc;
                  }, BigInt(values[0] || '0'));
                  result[outputName] = min.toString();
                } catch {
                  result[outputName] = Math.min(...values.map(v => parseFloat(v || '0'))).toString();
                }
                break;
              case 'max':
                try {
                  const max = values.reduce((acc, v) => {
                    const num = BigInt(v || '0');
                    return num > acc ? num : acc;
                  }, 0n);
                  result[outputName] = max.toString();
                } catch {
                  result[outputName] = Math.max(...values.map(v => parseFloat(v || '0'))).toString();
                }
                break;
            }
          }

          return result;
        });

        // Sort results
        const sortColumn = sortBy || (aggregations[0] ? (aggregations[0].alias || `${aggregations[0].function}_${aggregations[0].column}`) : groupBy);
        results.sort((a, b) => {
          const aVal = a[sortColumn];
          const bVal = b[sortColumn];
          try {
            const aNum = BigInt(aVal || '0');
            const bNum = BigInt(bVal || '0');
            return sortOrder === 'desc' ? (bNum > aNum ? 1 : -1) : (aNum > bNum ? 1 : -1);
          } catch {
            const aNum = parseFloat(aVal || '0');
            const bNum = parseFloat(bVal || '0');
            return sortOrder === 'desc' ? bNum - aNum : aNum - bNum;
          }
        });

        // Limit results
        const limitedResults = results.slice(0, limit);

        // Generate output CSV
        const timestamp = Date.now();
        const baseName = path.basename(resolvedPath, '.csv');
        const outputFileName = `${baseName}_aggregated_${timestamp}.csv`;
        const outputPath = path.join(__dirname, 'output', outputFileName);

        if (limitedResults.length > 0) {
          const outputHeaders = Object.keys(limitedResults[0]);
          const csvLines = [
            outputHeaders.join(','),
            ...limitedResults.map(row =>
              outputHeaders.map(h => `"${String(row[h] || '').replace(/"/g, '""')}"`).join(',')
            )
          ];
          fs.writeFileSync(outputPath, csvLines.join('\n'));
        }

        const outputUrl = `file://${outputPath}`;

        return {
          content: [
            {
              type: "text",
              text: `Aggregation complete!\n\nInput: ${resolvedPath}\nOutput: ${outputPath}\nOutput URL: ${outputUrl}\n\nGrouped by: ${groupBy}\nTotal groups: ${results.length}\nShowing: ${limitedResults.length}\n\nTop results:\n${JSON.stringify(limitedResults.slice(0, 10), null, 2)}`,
            },
          ],
        };
      }

      default:
        return {
          content: [
            {
              type: "text",
              text: `Unknown tool: ${name}`,
            },
          ],
        };
    }
  } catch (error: any) {
    return {
      content: [
        {
          type: "text",
          text: `Error: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Pipes Generator MCP Server running on stdio");
}

main().catch(console.error);
