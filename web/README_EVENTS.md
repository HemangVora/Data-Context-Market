# 🎯 Blockchain Events Integration - Complete

## What Was Built

Successfully integrated SQD-indexed blockchain events into the UI, creating a real-time dashboard that displays `DataUploaded` events from your BAHack smart contract.

## Architecture Overview

```
┌─────────────────┐
│  Smart Contract │  (Sepolia: 0x5b0b...91B9)
│    BAHack.sol   │  Emits: DataUploaded events
└────────┬────────┘
         │ Event: DataUploaded(Id, description, priceUSDC, payAddress, timestamp)
         ↓
┌─────────────────┐
│  SQD Indexer    │  (sqd/pipe-bahack.ts)
│  ClickHouse DB  │  Stores events in: bahack_events table
└────────┬────────┘
         │ HTTP Query
         ↓
┌─────────────────┐
│   Next.js API   │  (web/src/app/api/events/route.ts)
│   Route Handler │  GET /api/events
└────────┬────────┘
         │ JSON Response
         ↓
┌─────────────────┐
│  React UI       │  (web/src/components/DatasetEvents.tsx)
│  Component      │  Displays events with auto-refresh
└─────────────────┘
```

## Files Created

### 1. API Route: `web/src/app/api/events/route.ts`

- Connects to ClickHouse database
- Queries `bahack_events` table
- Returns events sorted by block number (newest first)
- Error handling for database connection issues

**Endpoint:** `GET /api/events`

**Response:**

```json
{
  "success": true,
  "count": 2,
  "events": [
    {
      "block_number": 9680123,
      "timestamp": 1732240000,
      "text_id": "dataset-001",
      "description": "Financial market data Q4 2024",
      "price_usdc": "1000000",
      "pay_address": "0x123...",
      "tx_hash": "0xabc..."
    }
  ]
}
```

### 2. UI Component: `web/src/components/DatasetEvents.tsx`

- Beautiful card-based layout matching your design system
- Real-time updates (refreshes every 30 seconds)
- Loading and error states
- Features:
  - 💰 **Price formatting** - Converts USDC from 6 decimals
  - 🕐 **Timestamp formatting** - Human-readable dates
  - 🔗 **Etherscan links** - Direct links to transactions
  - 📦 **Block numbers** - Shows blockchain block
  - 🎨 **Animations** - Smooth fade-in effects with Framer Motion

### 3. Page Integration: `web/src/app/page.tsx`

Updated to include DatasetEvents component:

```tsx
<Hero />
<DatasetEvents />  {/* ← New: Shows indexed blockchain events */}
<Marketplace />
```

### 4. Documentation: `web/EVENTS_SETUP.md`

Complete setup guide with:

- Architecture explanation
- Step-by-step setup instructions
- Testing procedures
- Troubleshooting guide

## How to Use

### Prerequisites

```bash
# 1. Install dependencies (already done)
cd web && npm install @clickhouse/client

# 2. Start ClickHouse database
cd sqd && docker-compose up -d

# 3. Run the indexer (keep running)
cd sqd && npx ts-node pipe-bahack.ts
```

### Start the Application

```bash
cd web
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000)

## UI Features

### Event Cards Display:

- **Dataset ID** - Unique identifier from blockchain
- **Description** - Dataset details
- **Price** - Auto-formatted in USDC (e.g., $1.50 USDC)
- **Timestamp** - When the event was emitted
- **Block Number** - Blockchain block height
- **Transaction Link** - Clickable link to Etherscan
- **Payment Address** - Shortened wallet address

### States:

1. **Loading** - Shows spinner while fetching
2. **Empty** - Friendly message when no events exist
3. **Error** - Clear error message with troubleshooting hint
4. **Success** - Beautiful grid of event cards

## Testing

### Quick Test - Upload a Dataset

```bash
cd sqd

# Upload a test dataset to the smart contract
cast send 0x5b0b1cbF40C910f58B8Ff1d48A629f257a556B99 \
  "upload(string,string,uint256,string)" \
  "test-dataset-$(date +%s)" \
  "A test dataset for UI verification" \
  1500000 \
  "0xYourPaymentAddress" \
  --rpc-url $RPC_URL \
  --private-key $PRIVATE_KEY
```

The event will appear on your UI within 30 seconds!

### Verify Data Flow

1. **Check ClickHouse:**

```bash
docker exec clickhouse clickhouse-client --password password \
  -q "SELECT text_id, description, price_usdc FROM bahack_events"
```

2. **Check API:**

```bash
curl http://localhost:3000/api/events | jq
```

3. **Check UI:** Refresh your browser at [http://localhost:3000](http://localhost:3000)

## Environment Variables

The API route uses these defaults (can override in `.env.local`):

```env
CLICKHOUSE_URL=http://localhost:8123
CLICKHOUSE_USER=default
CLICKHOUSE_PASSWORD=password
```

## Database Schema

**Table:** `bahack_events`

| Column       | Type   | Description                 |
| ------------ | ------ | --------------------------- |
| block_number | UInt64 | Blockchain block number     |
| timestamp    | UInt64 | Unix timestamp              |
| text_id      | String | Dataset unique identifier   |
| description  | String | Dataset description         |
| price_usdc   | String | Price in USDC (6 decimals)  |
| pay_address  | String | Payment destination address |
| tx_hash      | String | Transaction hash            |

## Component Layout

```
Hero Section
    ↓
DatasetEvents Section ← Real blockchain data
    ↓
Marketplace Section ← Mock/featured datasets
    ↓
Footer
```

## Next Steps / Ideas

1. **Add Filtering** - Filter by price range, date, etc.
2. **Add Search** - Search by dataset ID or description
3. **Add Pagination** - Currently shows latest 100 events
4. **Purchase Integration** - Add "Buy Now" buttons that interact with contract
5. **Real-time Updates** - Use WebSockets instead of polling
6. **Statistics** - Show total datasets, total volume, etc.
7. **User Profiles** - Link pay_address to user profiles

## Troubleshooting

### "Failed to fetch events"

- **Cause:** ClickHouse is not running
- **Fix:** `cd sqd && docker-compose up -d`

### No events showing

- **Cause:** Indexer hasn't processed events yet
- **Fix:** Run `cd sqd && npx ts-node pipe-bahack.ts`
- Or upload a test dataset (see above)

### Events not updating

- **Cause:** Indexer stopped
- **Fix:** Restart the indexer: `cd sqd && npx ts-node pipe-bahack.ts`

## Tech Stack

- **Next.js 16** - App Router with React Server Components
- **TypeScript** - Type safety
- **Tailwind CSS v4** - Styling
- **Framer Motion** - Animations
- **ClickHouse** - Events database
- **SQD** - Blockchain indexer
- **Viem** - Ethereum utilities

---

✅ **Status:** Fully integrated and ready to use!

The UI now displays real blockchain events indexed by SQD, creating a live dashboard of dataset uploads.
