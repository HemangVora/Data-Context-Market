<div align="center">
  <img src="img/logo.png" alt="Data Context Market" width="100"/>
  
  # Data Context Market (DCM)
  
  A decentralized marketplace for buying and selling data leveraging Filecoin storage, blockchain indexing with SQD, x402 micropayments and easy onboarding with CDP embedded wallets.
</div>

---

## Technology Stack

### 🤖 MCP (Model Context Protocol)

DCM is built as a suite of MCP servers that integrate directly with AI assistants like Claude. Users can index blockchain data, upload files, and manage datasets using natural language commands. AI agents can autonomously discover and purchase data.

### 📊 SQD (Subsquid) Pipes SDK

We built an MCP server around SQD Pipes SDK for natural language blockchain data indexing. Users can create pipes to index any smart contract event, apply custom filters, aggregate data, and export to CSV - all through prompts.

### 🗄️ Filecoin Storage

We built an MCP server for decentralized storage and marketplace functionality. Upload files to Filecoin, set pricing, register datasets on-chain, and enable AI agents to discover and purchase data.

### 💰 x402 Protocol

HTTP-native micropayments enabling AI agents to autonomously pay for data. Agents can discover datasets and purchase them instantly with USDC on Base - no human intervention required.

### 👛 Embedded Wallets

AI agents have their own embedded wallets to make autonomous payments. This enables true agent-to-agent commerce where agents can browse, purchase, and download data without user involvement.

### 🔗 Data Registry (On-Chain)

Smart contract on Sepolia tracking all uploaded datasets:

- Immutable record of every upload
- Discoverable metadata (name, description, price, PieceCID)
- Payment routing to creator wallets

### ⚡ ClickHouse

High-performance analytics database:

- Columnar storage optimized for aggregations
- Fast ingestion of millions of events
- SQL interface

---

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

**Flows:**
- 🤖 **AI/Claude**: SQD MCP (generate datasets) → DCM MCP (upload/download via x402)
- 👤 **Web UI**: Direct interaction with Backend (x402 protected downloads)
- 📊 **Indexing**: Smart Contract → SQD Indexer → ClickHouse

## 📦 Components

### [`contracts/dcm_registry`](./contracts/dcm_registry) - Smart Contract
Solidity registry on Sepolia. Stores metadata (PieceCID, price, payment address) and emits events for indexing. Gas-efficient event-only storage.

### [`server`](./server) - Backend API
Node.js/Express with x402 payment middleware. Handles Filecoin uploads/downloads, smart contract registration, and dataset discovery.

**Endpoints:** `/upload`, `/download`, `/discover_all`, `/discover_query`

### [`dcm-mcp-server`](./dcm-mcp-server) - DCM MCP Server
AI tools for marketplace interaction: upload, download, discover datasets. Auto-handles x402 payments for AI agents.

### [`sqd`](./sqd) - Event Indexer
Indexes blockchain events into ClickHouse. Tracks uploads, downloads, and payment transactions in real-time.

### [`mcp-sqd`](./mcp-sqd) - SQD MCP Server
AI tool for generating datasets from blockchain data. Creates custom SQD pipes, queries ClickHouse, exports CSVs.

### [`web`](./web) - Frontend UI
Next.js marketplace interface for browsing, uploading, and downloading datasets. Real-time blockchain event feed.

## 🚀 Quick Start

```bash
# 1. Deploy Contract
cd contracts/dcm_registry && npm install && npm run deploy:sepolia

# 2. Start Backend (configure .env first)
cd server && npm install && npm run dev

# 3. Run Indexer
cd sqd && docker-compose up -d && npm start

# 4. Launch Frontend
cd web && npm install && npm run dev

# 5. Configure MCP Servers (optional, for AI)
# Add dcm-mcp-server and mcp-sqd to Claude desktop config
```

## 🔑 Features

- **Decentralized Storage**: Filecoin with content addressing
- **Micropayments**: x402 protocol for sub-dollar transactions (USDC on Base Sepolia)
- **AI Integration**: MCP servers for Claude/AI agents (upload/download + dataset generation)
- **Event Indexing**: Real-time blockchain activity tracking via SQD → ClickHouse
- **Price Discovery**: On-chain pricing with flexible payment addresses

## 🛠️ Tech Stack

**Contracts:** Solidity, Hardhat (Sepolia) • **Storage:** Filecoin • **Indexing:** SQD, ClickHouse  
**Backend:** Node.js, Express, TypeScript, x402 • **Frontend:** Next.js 15, Tailwind, Framer Motion

## 📖 Docs

[Contracts](./contracts/dcm_registry/README.md) • [Server API](./server/README.md) • [Indexer](./sqd/README.md) • [Frontend](./web/README.md) • [Deployment](./DEPLOYMENT_CHECKLIST.md)

---

## 🤖 AI Tools Attribution

This project was built with assistance from AI tools:
- **Claude Desktop**: Used for testing and developing MCP tools
- **Cursor & Claude Code**: Provided coding assistance throughout the monorepo development

---

Built for ETHGlobal. See component READMEs for detailed setup.
