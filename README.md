# Data Context Market (DCM)

A decentralized marketplace for buying and selling data using Filecoin storage, blockchain indexing, and AI-powered discovery through x402 micropayments.

## 🏗️ Architecture

```
     ┌──────────┐                    ┌──────────┐
     │  Human   │                    │AI Agent  │
     │   User   │                    │          │
     └────┬─────┘                    └────┬─────┘
          │                               │
    ┌─────┴─────┐                         │
    │           │                         │
    ▼           ▼                         ▼
┌────────┐  ┌────────┐              ┌──────────┐
│  Web   │  │Claude  │              │   MCP    │
│   UI   │  │  AI    │─────────────►│  Server  │
└───┬────┘  └────────┘              └─────┬────┘
    │                                     │
    │      (x402 payments)    (x402 payments)
    │                                     │
    ▼                                     ▼
  ┌───────────────────────────────────────────┐
  │          Backend Server (x402 Protected)  │
  └───────┬──────────┬──────────┬─────────────┘
          │          │          │
          ▼          ▼          ▼
    ┌─────────┐ ┌──────────┐ ┌──────────┐
    │Filecoin │ │  Smart   │ │ClickHouse│
    │ Storage │ │ Contract │ │ Database │
    │         │ │(Sepolia) │ │          │
    └─────────┘ └──────┬───┘ └──────────┘
                       │           ▲
                       │           │
                       │      ┌────┴─────┐
                       └─────►│   SQD    │
                              │ Indexer  │
                              └──────────┘
```

**Interaction Paths:**
- 🤖 **AI Agent**: MCP Server → x402 payment → Backend Server
- 👤 **Human via Claude**: Claude → MCP Server → x402 payment → Backend Server  
- 👤 **Human via Web UI**: Web Frontend → x402 payment → Backend Server
- 🔄 **Backend**: Parallel interactions with Filecoin, Smart Contract, and ClickHouse
- 📊 **Data Indexing**: Smart Contract emits events → SQD Indexer → ClickHouse Database

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
**MCP Server for AI** - Model Context Protocol server for Claude/AI assistants

Provides AI tools to interact with the marketplace:
- `upload-to-filecoin` - Upload files/messages with pricing
- `download-from-filecoin` - Download by PieceCID
- `discover-and-download` - Search and download datasets

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
**MCP Server for Data Queries** - AI-powered data aggregation

MCP server that lets AI assistants:
- Create custom blockchain data pipes
- Query indexed events from ClickHouse
- Aggregate and analyze marketplace data
- Track user activity and dataset popularity

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
- **AI Integration**: MCP servers enable AI assistants to use the marketplace
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
