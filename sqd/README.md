# SQD Pipes

## Setup

```bash
docker-compose up -d
```

## Run Indexer

```bash
npx ts-node pipe-multi.ts
```

## Query

```bash
docker exec clickhouse clickhouse-client --password password \
  -q "SELECT block_number, event_type, sender, amount, value2 as balance FROM multi_logger_events"
```

## Interact with Contract

```bash
cast send 0xd892de662E18237dfBD080177Ba8cEc4bC6689E7 "increment()" --rpc-url $RPC_URL --private-key $PRIVATE_KEY

cast send 0xd892de662E18237dfBD080177Ba8cEc4bC6689E7 "deposit()" --value 0.0001ether --rpc-url $RPC_URL --private-key $PRIVATE_KEY

cast send 0xd892de662E18237dfBD080177Ba8cEc4bC6689E7 'log(string)' 'Hello SQD!' --rpc-url $RPC_URL --private-key $PRIVATE_KEY
```

## Reset Database

```bash
docker exec clickhouse clickhouse-client --password password -q "DROP DATABASE default"
docker exec clickhouse clickhouse-client --password password -q "CREATE DATABASE default"
```
