# Data Context Market (DCM)

A decentralized marketplace for buying and selling data using Filecoin storage, blockchain indexing, and AI-powered discovery through x402 micropayments.

## 🏗️ Architecture

```
      ┌──────────┐                     ┌──────────┐
      │  Human   │                     │ AI Agent │
      │   User   │                     │ (System) │
      └────┬─────┘                     └────┬─────┘
           │                                │
     ┌─────┴──────┐                         │
     │            │                         │
     ▼            ▼                         ▼
 ┌────────┐  ┌────────┐          ┌──────────────────────┐
 │  Web   │  │ Claude │◄────────►│      MCP LAYER       │
 │   UI   │  │   AI   │          │ (Tool Connectivity)  │
 └───┬────┘  └───┬────┘          └─────┬──────────┬─────┘
     │           │                     │          │
     │           │    ┌────────────────┘          │
     │(x402)     │    │                           │
     │           ▼    ▼                           ▼
     │       ┌───────────┐                  ┌───────────┐
     │       │  SQD MCP  │                  │  DCM MCP  │
     │       │  Server   │                  │  Server   │
     │       └───────────┘                  └─────┬─────┘
     │                                            │
     ▼                                            │(x402)
  ┌───────────────────────────────────────────────▼─────┐
  │                    Backend                          │
  │              (Downloads x402 Protected)             │
  └──────┬───────────────────────┬──────────────────▲───┘
         │                       │                  │
         │(Encrypt)              ▼                  │
         ▼                 ┌──────────┐             │
   ┌──────────┐            │ Registry │             │
   │ Filecoin │            │  Smart   │             │
   │ Storage  │            │ Contract │             │
   │          │            └─────┬────┘             │
   └──────────┘                  │                  │
                           ┌─────▼─────┐            │
                           │    SQD    │            │
                           │  Indexer  │            │
                           └─────┬─────┘            │
                                 │                  │
                           ┌─────▼─────┐            │
                           │  ClickH.  │────────────┘
                           │ Database  │
                           └───────────┘
```

**Interaction Paths:**
- 🤖 **AI Agent / Human via Claude**: 
  1. **Generate dataset**: Claude/AI ← SQD MCP returns datasets
  2. **Upload dataset**: Claude/AI → DCM MCP → x402 payment → Backend → Filecoin
  3. **Download content**: DCM MCP → x402 payment → Backend → Filecoin
- 👤 **Human via Web UI**: Web UI → x402 payment → Backend Server
- 🔄 **Backend**: Handles Filecoin storage, smart contract registration, and ClickHouse queries
- 📊 **Data Indexing**: Smart Contract events → SQD Indexer → ClickHouse
- 🔍 **x402 Payments**: Only between Web UI/DCM MCP and Backend Server

## 📦 Components

### [`contracts/dcm_registry`](./contracts/dcm_registry)
**Smart Contract Registry** - Solidity contract on Sepolia testnet

- Registers uploaded data metadata (PieceCID, price, payment address, file info)
- Emits `DataUploaded` and `DataDownloaded` events for indexing
- Provides on-chain pricing and payment information lookup
- Event-only storage model for gas efficiency

**Key Functions:**
- `register_upload()` - Register new data to marketplace
- `register_download()` - Track download events with payment hash
- `getData()` - Retrieve data metadata by PieceCID

### [`server`](./server)
**Backend API Server** - Node.js/Express with x402 payment middleware

- Handles file uploads to Filecoin and returns PieceCIDs
- Manages file downloads from Filecoin storage
- Implements x402 payment protocol (402 HTTP status for paywalls)
- Integrates with smart contract for registration

**Key Endpoints:**
- `POST /upload` - Upload content to Filecoin, register on-chain
- `GET /download?pieceCid=<id>` - Download content (with payment)
- `GET /hello` - Free endpoint for testing
- `GET /weather` - Example paid endpoint ($0.001 USDC)

### [`dcm-mcp-server`](./dcm-mcp-server)
**DCM MCP Server** - Model Context Protocol server for Data Context Market

Provides AI tools to interact with the marketplace:
- `upload-to-DCM` - Upload files/messages with pricing
- `download-from-DCM` - Download by PieceCID
- `discover-data` - Search for datasets
- `discover-and-download` - Search and download in one step

Automatically handles x402 micropayments transparently for AI agents.

### [`sqd`](./sqd)
**Blockchain Event Indexer** - SQD processor for event indexing

- Monitors smart contract events in real-time
- Indexes `DataUploaded` and `DataDownloaded` events
- Stores data in ClickHouse database for fast queries
- Provides historical data and analytics

**Capabilities:**
- Track all marketplace uploads and downloads
- Query dataset metadata and pricing history
- Monitor payment transactions
- Generate marketplace analytics

### [`mcp-sqd`](./mcp-sqd)
**SQD MCP Server** - AI-powered blockchain data aggregation

MCP server that lets AI assistants generate datasets from blockchain data:
- Create custom SQD pipes for any EVM contract
- Query and aggregate indexed events from ClickHouse
- Generate CSV datasets from on-chain data
- Analyze marketplace activity and trends

Generated datasets can then be uploaded to DCM via the DCM MCP Server.

### [`web`](./web)
**Frontend UI** - Next.js marketplace interface

Modern web interface featuring:
- Browse available datasets
- View pricing and metadata
- Dataset upload/download flows
- Real-time event feed from blockchain
- Beautiful dark theme with animations

## 🚀 Quick Start

### 1. Deploy Smart Contract
```bash
cd contracts/dcm_registry
npm install
cp env.template .env
# Add your PRIVATE_KEY to .env
npm run deploy:sepolia
```

### 2. Start Backend Server
```bash
cd server
npm install
# Configure .env with contract address and keys
npm run dev
# Server runs on http://localhost:4021
```

### 3. Run SQD Indexer
```bash
cd sqd
npm install
docker-compose up -d  # Start ClickHouse
# Configure .env with contract address and ClickHouse URL
npm start
```

### 4. Launch Web Frontend
```bash
cd web
npm install
npm run dev
# Open http://localhost:3000
```

### 5. Configure MCP Servers (for AI)
```bash
# DCM MCP Server
cd dcm-mcp-server
npm install
# Add to Claude desktop config

# SQD MCP Server
cd mcp-sqd
npm install
# Add to Claude desktop config
```

## 🔑 Key Features

- **Decentralized Storage**: Files stored on Filecoin with content addressing
- **Micropayments**: x402 protocol enables sub-dollar transactions
- **Event Indexing**: All marketplace activity indexed for analytics
- **AI Integration**: 
  - DCM MCP Server: Upload/download marketplace content
  - SQD MCP Server: Generate datasets from blockchain data
- **Price Discovery**: On-chain pricing with flexible payment addresses
- **Real-time Updates**: Blockchain events indexed within seconds

## 💰 Payment Flow

1. User uploads data → Backend stores in Filecoin → Returns PieceCID
2. Smart contract registers metadata with price and payment address
3. SQD indexes event to database
4. Buyer downloads → Server returns 402 with payment details
5. Buyer pays via x402 → Server releases content
6. Download event registered on-chain

## 🛠️ Tech Stack

- **Smart Contracts**: Solidity, Hardhat (Sepolia testnet)
- **Storage**: Filecoin
- **Indexing**: SQD (Subsquid), ClickHouse
- **Backend**: Node.js, Express, TypeScript
- **Frontend**: Next.js 15, Tailwind CSS, Framer Motion
- **Payments**: x402 protocol (USDC on Base Sepolia)
- **AI Tools**: Model Context Protocol (MCP)

## 📖 Documentation

- [`contracts/dcm_registry/README.md`](./contracts/dcm_registry/README.md) - Smart contract details
- [`server/README.md`](./server/README.md) - API documentation
- [`sqd/README.md`](./sqd/README.md) - Indexer setup
- [`web/README.md`](./web/README.md) - Frontend guide
- [`DEPLOYMENT_CHECKLIST.md`](./DEPLOYMENT_CHECKLIST.md) - Railway deployment guide

## 🌐 Deployed Services

See [`contracts/dcm_registry/deployments/sepolia.json`](./contracts/dcm_registry/deployments/sepolia.json) for contract addresses and deployment details.

## 🤝 Contributing

This project was built for ETHGlobal. See individual component READMEs for setup and development instructions.
