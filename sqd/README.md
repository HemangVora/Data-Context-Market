# SQD Pipes

## Run

```bash
npx ts-node pipe-multi.ts
```

## Query

```bash
docker exec clickhouse clickhouse-client --password password \
  -q "SELECT block_number, event_type, topic1 as sender FROM multi_logger_events"
```
