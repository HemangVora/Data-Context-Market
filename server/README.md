## Server

### Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Create a `.env` file** (copy from `.env-local` if it exists, or create one with):
   ```env
   FACILITATOR_URL=https://x402.org/facilitator
   NETWORK=base-sepolia
   ADDRESS=0xYourEthereumAddress
   
   # Filecoin endpoints
   PRIVATE_KEY=your_private_key_here  # Required for all Filecoin operations
   RPC_URL=https://api.calibration.node.glif.io/rpc/v1
   
   # Smart contract (Sepolia)
   SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_INFURA_KEY
   # Or use a public RPC: https://rpc.sepolia.org
   
   # required if using the Base mainnet facilitator
   CDP_API_KEY_ID="Coinbase Developer Platform Key"
   CDP_API_KEY_SECRET="Coinbase Developer Platform Key Secret"
   ```
   
   **Important:** 
   - Replace `0xYourEthereumAddress` with your actual Ethereum address where you want to receive payments.
   - `PRIVATE_KEY` is required for all Filecoin operations (upload and download).
   - `SEPOLIA_RPC_URL` is required for smart contract registration. You can get a free RPC URL from Infura, Alchemy, or use a public RPC like `https://rpc.sepolia.org`.

3. **Run the server:**
   ```bash
   npm run dev
   ```
   
   The server will start on `http://localhost:4021`

### Endpoints

#### Free Endpoints

- **`GET /hello`** - Health check endpoint
  - Returns: `{"hello": "world"}`

#### Upload Endpoint

- **`POST /upload`** - Upload content to Filecoin storage
  - **Body parameters:**
    - `message` (optional): Text message to upload
    - `file` (optional): Base64-encoded file data
    - `filename` (optional): Filename (required with `file`)
    - `mimeType` (optional): MIME type
    - `url` (optional): URL to download and upload
    - `name` (required): Name of the file/data
    - `description` (required): Description
    - `priceUSDC` (required): Price in USDC (6 decimals, e.g., 1000000 = $1.00)
    - `payAddress` (required): Payment address (0x... or Solana)
  - **Returns:** `{ "success": true, "pieceCid": "...", "size": 123, "dataRegistryTxHash": "..." }`
  - **Example:**
    ```bash
    curl -X POST http://localhost:4021/upload \
      -H "Content-Type: application/json" \
      -d '{
        "message": "Hello, Filecoin!",
        "name": "greeting",
        "description": "A test message",
        "priceUSDC": "1000000",
        "payAddress": "0x..."
      }'
    ```

#### Download Endpoints (x402 Protected)

- **`GET /download?pieceCid=<PieceCID>`** - Download content by PieceCID
  - **Query params:** `pieceCid` (required)
  - **Returns:** JSON with content (text or base64-encoded binary) + metadata
  - **Payment:** Required via x402 (402 status if payment missing)
  
- **`GET /download/:pieceCid`** - Download content by PieceCID (path param)
  - **Path param:** `pieceCid`
  - **Returns:** Same as above
  
- **`GET /download_test?pieceCid=<PieceCID>`** - Download without payment (testing only)
  - **Query params:** `pieceCid` (required)
  - **Returns:** Content without payment verification

#### Discovery Endpoints (Free)

- **`GET /discover_all`** - Get all available datasets
  - **Returns:** 
    ```json
    {
      "success": true,
      "count": 5,
      "results": [
        {
          "pieceCid": "baga6ea...",
          "name": "Dataset Name",
          "description": "Dataset description",
          "price": "1000000",
          "filetype": "text/csv",
          "payAddress": "0x..."
        }
      ]
    }
    ```

- **`GET /discover_query?q=<query>`** - Search datasets by query
  - **Query params:** `q` (required) - Search query
  - **Returns:** Top 3 matching datasets with relevance scores
  - **Example:** `GET /discover_query?q=financial+data`
  - **Returns:**
    ```json
    {
      "success": true,
      "query": "financial data",
      "count": 3,
      "results": [
        {
          "pieceCid": "baga6ea...",
          "name": "Financial Dataset",
          "description": "Stock market data",
          "price": "5000000",
          "filetype": "text/csv",
          "payAddress": "0x...",
          "score": 85.5
        }
      ]
    }
    ```

### Testing

**Test without payment:**
```bash
# Upload
curl -X POST http://localhost:4021/upload \
  -H "Content-Type: application/json" \
  -d '{"message":"test","name":"test","description":"test","priceUSDC":"1000000","payAddress":"0x..."}'

# Download (no payment)
curl http://localhost:4021/download_test?pieceCid=<PieceCID>

# Discovery
curl http://localhost:4021/discover_all
curl http://localhost:4021/discover_query?q=test
```

**Test with payment (x402):**
- Downloads require x402 payment header
- Server returns 402 status if `X-PAYMENT` header is missing
- Use x402-compatible client (like DCM MCP Server) for automatic payment handling