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

// Generate pipe code
function generatePipeCode(
  contractAddress: string,
  events: any[],
  tableName: string,
  network: string,
  fromBlock: number
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

  return `import { createClient } from '@clickhouse/client';
import { evmPortalSource, EvmQueryBuilder, type EvmPortalData } from '@subsquid/pipes/evm';
import { clickhouseTarget } from '@subsquid/pipes/targets/clickhouse';
import { keccak256, toBytes } from 'viem';
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
};

// Event signatures
const TOPICS = {
${topicsCode}
};

function getEventType(topic0: string): string {
  for (const [name, hash] of Object.entries(TOPICS)) {
    if (topic0 === hash) return name;
  }
  return "Unknown";
}

async function main() {
  console.log('Pipe for ${tableName}');
  console.log('Contract:', CONFIG.CONTRACT_ADDRESS);
  console.log('Network: ${network}');
  console.log('Events:', Object.keys(TOPICS).join(', '));

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
          url: CONFIG.CLICKHOUSE_URL,
          username: 'default',
          password: '',
        }),
        onStart: async ({ store }) => {
          await store.command({
            query: \`
              CREATE TABLE IF NOT EXISTS \${CONFIG.TABLE_NAME} (
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
          const headers = ['block_number', 'timestamp', 'event_type', 'tx_hash', 'log_index', 'data', 'topic1', 'topic2', 'topic3'];

          const rows = data.map(e =>
            [e.block_number, e.timestamp, e.event_type, e.tx_hash, e.log_index, e.data, e.topic1, e.topic2, e.topic3]
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
          console.log(\`Processed \${data.length} events (CSV + ClickHouse)\`);
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
}

void main();
`;
}

// Tool handlers
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "generate_pipe",
        description:
          "Generate a Subsquid pipe for indexing blockchain events. Fetches ABI from Etherscan and creates pipe code. Use get_contract_events first to see available events. IMPORTANT: Always display the COMPLETE file paths returned by this tool to the user - do not shorten or abbreviate paths.",
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
          },
          required: ["contractAddress", "tableName", "outputFile"],
        },
      },
      {
        name: "run_pipe",
        description: "Run a generated pipe script. IMPORTANT: Always display the COMPLETE file paths (CSV path, URL) returned by this tool to the user - do not shorten or abbreviate paths.",
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
          fromBlock
        );

        // Write to file
        const outputPath = path.resolve(__dirname, outputFile);
        fs.writeFileSync(outputPath, code);

        const eventList = events.map((e) => e.name).join(", ");
        const outputDir = path.join(__dirname, 'output');
        const csvPath = path.join(outputDir, `${tableName}.csv`);
        const csvUrl = `file://${csvPath}`;
        const pipeUrl = `file://${outputPath}`;

        return {
          content: [
            {
              type: "text",
              text: `Successfully generated pipe at ${outputPath}\n- Pipe URL: ${pipeUrl}\n\nEvents indexed: ${eventList}\n\nOutput will be saved to:\n- CSV: ${csvPath}\n- CSV URL: ${csvUrl}\n- ClickHouse table: ${tableName}\n\nTo run: use run_pipe tool with pipeFile="${outputFile}"`,
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
