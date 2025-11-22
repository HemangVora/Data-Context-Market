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
   PRIVATE_KEY=your_private_key_here  # Required for /upload, optional for /download
   RPC_URL=https://api.calibration.node.glif.io/rpc/v1
   
   # required if using the Base mainnet facilitator
   CDP_API_KEY_ID="Coinbase Developer Platform Key"
   CDP_API_KEY_SECRET="Coinbase Developer Platform Key Secret"
   ```
   
   **Important:** 
   - Replace `0xYourEthereumAddress` with your actual Ethereum address where you want to receive payments.
   - The `/download` endpoint doesn't require a private key - downloads are public.
   - The `/upload` endpoint requires a valid `PRIVATE_KEY` for authentication.

3. **Run the server:**
   ```bash
   npm run dev
   ```
   
   The server will start on `http://localhost:4021`

### Endpoints

- `GET /hello` - Free endpoint, returns `{"hello": "world"}`
- `GET /weather` - Requires payment of $0.001 (USDC on base-sepolia)
- `GET /premium/content` - Requires payment (custom token amount)
- `POST /upload` - Stores a message to Filecoin and returns the PieceCID
  - Body: `{ "message": "your message here" }`
  - Returns: `{ "success": true, "pieceCid": "...", "size": 123 }`
  - Example: `curl -X POST http://localhost:4021/upload -H "Content-Type: application/json" -d '{"message":"Hello, Filecoin!"}'`
- `GET /download?pieceCid=<PieceCID>` - Downloads and returns content from Filecoin storage
  - Example: `GET /download?pieceCid=baga6ea4seaq...`
  - Returns JSON with the downloaded content (text or base64-encoded binary)

### Testing

You can test the endpoints using curl or any HTTP client. The server will return a 402 status with payment requirements if the `X-PAYMENT` header is missing.