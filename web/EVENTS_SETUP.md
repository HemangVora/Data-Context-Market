# Dataset Events Setup Guide

This guide explains how to view indexed blockchain events in your UI.

## Architecture

1. **Smart Contract** (`contract/contracts/BAHack.sol`) - Emits `DataUploaded` events
2. **SQD Indexer** (`sqd/pipe-bahack.ts`) - Indexes events into ClickHouse database
3. **API Route** (`web/src/app/api/events/route.ts`) - Queries ClickHouse
4. **UI Component** (`web/src/components/DatasetEvents.tsx`) - Displays events

## Setup Steps

### 1. Start ClickHouse Database

```bash
cd sqd
docker-compose up -d
```

Verify it's running:

```bash
docker ps | grep clickhouse
```

### 2. Update SQD Indexer for Railway

Update the ClickHouse configuration in `sqd/pipe-bahack.ts` to use your Railway credentials:

```typescript
const CONFIG = {
  // ... other config
  CLICKHOUSE_URL:
    process.env.CLICKHOUSE_URL || "https://your-railway-clickhouse.railway.app",
  CLICKHOUSE_USER: process.env.CLICKHOUSE_USER || "default",
  CLICKHOUSE_PASSWORD: process.env.CLICKHOUSE_PASSWORD || "your_password",
};
```

Then run the indexer:

```bash
cd sqd
npx ts-node pipe-bahack.ts
```

**Note:** Keep this running in the background. It will continuously index new events.

### 3. Start the Web Application

```bash
cd web
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## 🚂 Production Deployment (Railway)

For production deployment on Railway, see:

- **SQD Indexer:** [sqd/RAILWAY_DEPLOY.md](../sqd/RAILWAY_DEPLOY.md)
- **Complete Guide:** [DEPLOYMENT_CHECKLIST.md](../DEPLOYMENT_CHECKLIST.md)

Quick summary:

1. Deploy ClickHouse on Railway
2. Deploy SQD Indexer with Railway credentials
3. Deploy Web App (Railway or Vercel) with Railway ClickHouse credentials

---

## Testing

### Option 1: Upload Data via Smart Contract

Upload a dataset to trigger a `DataUploaded` event:

```bash
# From sqd/ directory
cast send 0x5b0b1cbF40C910f58B8Ff1d48A629f257a556B99 \
  "upload(string,string,uint256,string)" \
  "my-dataset-1" \
  "A sample dataset for testing" \
  1000000 \
  "0xYourPaymentAddress" \
  --rpc-url $RPC_URL \
  --private-key $PRIVATE_KEY
```

The indexer will pick up this event and store it in ClickHouse within seconds.

### Option 2: Query Existing Events

Check if events are already indexed using Railway's ClickHouse URL:

**Using curl:**

```bash
curl -X POST "https://your-clickhouse-instance.railway.app" \
  --user "default:your_password" \
  -d "SELECT * FROM bahack_events FORMAT JSONEachRow"
```

**Or using clickhouse-client if installed:**

```bash
clickhouse-client --host your-clickhouse-instance.railway.app \
  --port 9440 \
  --secure \
  --user default \
  --password your_password \
  --query "SELECT * FROM bahack_events"
```

### Verify API Route

Test the API directly:

```bash
curl http://localhost:3000/api/events
```

Expected response:

```json
{
  "success": true,
  "count": 1,
  "events": [
    {
      "block_number": 9680123,
      "timestamp": 1732240000,
      "text_id": "my-dataset-1",
      "description": "A sample dataset for testing",
      "price_usdc": "1000000",
      "pay_address": "0x...",
      "tx_hash": "0x..."
    }
  ]
}
```

## UI Features

The `DatasetEvents` component displays:

- **Dataset ID** - Unique identifier
- **Description** - Dataset details
- **Price** - Formatted in USDC (converted from 6 decimals)
- **Timestamp** - Human-readable date/time
- **Block Number** - Blockchain block
- **Transaction Link** - Direct link to Etherscan
- **Payment Address** - Shortened address

The component:

- Auto-refreshes every 30 seconds
- Shows loading state while fetching
- Displays error messages if ClickHouse is unavailable
- Animates new events as they appear

## Troubleshooting

### "Failed to fetch events" Error

**Problem:** ClickHouse is not running or not accessible.

**Solution:**

```bash
cd sqd
docker-compose up -d
```

### No Events Showing

**Problem:** Indexer hasn't processed any events yet.

**Solutions:**

1. Make sure the indexer is running: `npx ts-node pipe-bahack.ts`
2. Upload a test dataset (see Option 1 above)
3. Check if events exist in ClickHouse: `docker exec clickhouse clickhouse-client --password password -q "SELECT COUNT(*) FROM bahack_events"`

### API Returns Empty Array

**Problem:** Events are indexed but table is empty.

**Solution:** Upload a dataset to the smart contract to trigger an event.

## Environment Variables

Create `.env.local` in the `web/` directory:

```env
CLICKHOUSE_URL=http://localhost:8123
CLICKHOUSE_USER=default
CLICKHOUSE_PASSWORD=password
```

## Development

The events component is integrated into the main page after the Hero section:

```tsx
// web/src/app/page.tsx
<Hero />
<DatasetEvents />  {/* Shows indexed events */}
<Marketplace />
```

To customize the component, edit:

- `web/src/components/DatasetEvents.tsx` - UI styling and layout
- `web/src/app/api/events/route.ts` - Query logic and data transformation
