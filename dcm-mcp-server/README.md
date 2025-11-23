# Data Context Market MCP Server

MCP server for AI assistants to interact with DCM (Data Context Market) via Filecoin storage. Automatically handles x402 micropayments.

## Tools

### 1. `upload-to-DCM`
Upload content to Data Context Market storage.

**Parameters:**
- `message/file/url/filePath` (one required): Content to upload
- `name` (required): Name of the file/data
- `description` (required): Description
- `priceUSD` (required): Price in USD (e.g., 0.01)
- `payAddress` (required): Payment address (0x... or Solana)
- `filename`, `mimeType` (optional): File metadata

### 2. `download-from-DCM`
Download content using a PieceCID. Automatically handles x402 payment.

**Parameters:**
- `pieceCid` (required): The PieceCID to download

### 3. `discover-data`
Search datasets by query. Returns metadata only (no download).

**Parameters:**
- `query` (required): Search query

### 4. `discover-and-download`
Search and download in one operation.

**Parameters:**
- `query` (required): Search query

## Configuration

### Environment Variables

```env
PRIVATE_KEY=0x...  # Required for x402 payments
RESOURCE_SERVER_URL=https://ba-hack-production.up.railway.app  # Optional
```

### Claude Desktop Setup

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`  
**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "DCM-mcp": {
      "command": "pnpm",
      "args": [
        "--silent",
        "-C",
        "your_path_to_repo/Data-Context-Market/dcm-mcp-server",
        "dev"
      ],
      "env": {
        "PRIVATE_KEY": "0x...",
        "RESOURCE_SERVER_URL": "https://ba-hack-production.up.railway.app"
      }
    }
  }
}
```

## Features

- **x402 Payments**: Automatic payment handling via x402-axios
- **Price Formatting**: Converts USDC to readable USD format ($0.01, $1.00)
- **Smart Contract**: Registers uploads on DataContextMarketRegistry (Sepolia)
- **Validation**: PieceCIDs, addresses, base64 data, prices
- **Type Safety**: Full TypeScript with Zod schemas

## Networks

- **Payment**: Base Sepolia testnet
- **Contract**: Sepolia testnet
- **Storage**: Filecoin

## How It Works

**Upload:** Content → DCM Backend → Filecoin + Smart Contract → PieceCID

**Download:** PieceCID → DCM Backend → 402 response → x402 payment → Content

**Discover:** Query → ClickHouse → Ranked results

## Troubleshooting

- **"PRIVATE_KEY is required"**: Set env variable with hex private key (0x...)
- **"Network error"**: Check internet and RESOURCE_SERVER_URL
- **"Invalid PieceCID"**: Must start with `bafk` or `baga`
- **"Payment failed"**: Ensure wallet has USDC on Base Sepolia

## Security

- Never commit `PRIVATE_KEY`
- Ensure sufficient USDC balance on Base Sepolia for payments
