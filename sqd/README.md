# SQD Blockchain Indexer

Indexes `DataUploaded` events from the BAHack smart contract into ClickHouse database.

## 🚀 Quick Start

### Local Development (Docker)

```bash
# Start ClickHouse
docker-compose up -d

# Run indexer
npm start
```

### Railway Deployment (Production)

See [RAILWAY_DEPLOY.md](./RAILWAY_DEPLOY.md) for complete deployment guide.

**Quick Deploy:**

1. Deploy ClickHouse on Railway
2. Push code to GitHub
3. Create new Railway service from GitHub repo
4. Set root directory to `sqd`
5. Add environment variables (see below)

## Run Indexers

### BAHack Indexer (Primary)

```bash
npm start
```

### MultiLogger Indexer (Example)

```bash
npm run multi
```

## Environment Variables

Create a `.env` file (see `.env.example`):

```env
# Smart Contract
CONTRACT_ADDRESS=0x5b0b1cbF40C910f58B8Ff1d48A629f257a556B99
FROM_BLOCK=9680000

# SQD Portal
PORTAL_URL=https://portal.sqd.dev/datasets/ethereum-sepolia

# ClickHouse (Railway or Local)
CLICKHOUSE_URL=https://your-clickhouse.railway.app
CLICKHOUSE_USER=default
CLICKHOUSE_PASSWORD=your_password
```

## Query Events

### Local ClickHouse (Docker)

```bash
docker exec clickhouse clickhouse-client --password password \
  -q "SELECT * FROM bahack_events"
```

### Railway ClickHouse

```bash
curl -X POST "https://your-clickhouse.railway.app" \
  --user "default:your_password" \
  -d "SELECT * FROM bahack_events FORMAT JSONEachRow"
```

## Interact with Contracts

### MultiLogger (0xd892de662E18237dfBD080177Ba8cEc4bC6689E7)

```bash
cast send 0xd892de662E18237dfBD080177Ba8cEc4bC6689E7 "increment()" --rpc-url $RPC_URL --private-key $PRIVATE_KEY

cast send 0xd892de662E18237dfBD080177Ba8cEc4bC6689E7 "deposit()" --value 0.0001ether --rpc-url $RPC_URL --private-key $PRIVATE_KEY

cast send 0xd892de662E18237dfBD080177Ba8cEc4bC6689E7 'log(string)' 'Hello SQD!' --rpc-url $RPC_URL --private-key $PRIVATE_KEY
```

### BAHack (0x5b0b1cbF40C910f58B8Ff1d48A629f257a556B99)

```bash
cast send 0x5b0b1cbF40C910f58B8Ff1d48A629f257a556B99 "upload(string,string,uint256,string)" "id1" "description" 1000000 "0xPayAddress" --rpc-url $RPC_URL --private-key $PRIVATE_KEY
```

## Reset Database

```bash
docker exec clickhouse clickhouse-client --password password -q "DROP DATABASE default"
docker exec clickhouse clickhouse-client --password password -q "CREATE DATABASE default"
```
