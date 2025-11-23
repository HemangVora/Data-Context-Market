# Subsquid Pipes MCP - Example Prompts

## Simple Contract (Sepolia)

```
Create and run a pipe to track the number of incrementation on the contract 0xd892de662E18237dfBD080177Ba8cEc4bC6689E7 from block 9679658 on sepolia
```

## Aave Whales and Aggregation

### Step 1 - Create & Run Pipe

```
Generate and run a pipe for Aave V3 at 0x87870bca3f3fd6335c3f4ce8392d69350b4fa4e2 on mainnet. Track Supply and Withdraw events with minimum amount filter of 100000000000000000000000 (100k tokens). From block 16291127, table name "aave_whales".
```

### Step 2 - Stop & Aggregate

```
Stop the pipe. Then aggregate the CSV file, group by from_address, sum the amount column as total_amount, count transactions as tx_count, sort by total_amount desc, limit 20.
```
