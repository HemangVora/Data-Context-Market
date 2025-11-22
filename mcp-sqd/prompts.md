# Subsquid Pipes MCP - Example Prompts

## DeFi Lending (Aave, Compound)

### Track liquidations

```
Index liquidations on Aave V3 0x87870bca3f3fd6335c3f4ce8392d69350b4fa4e2 from block 16291127 on mainnet
```

### Monitor whale deposits

```
Track deposits over 100 ETH on Aave V3 0x87870bca3f3fd6335c3f4ce8392d69350b4fa4e2 from block 16291127
```

### All lending activity

```
Index Supply, Borrow, Repay, Withdraw events on 0x87870bca3f3fd6335c3f4ce8392d69350b4fa4e2 from block 16291127
```

## DEX Trading (Uniswap, Sushiswap)

### Large swaps on Uniswap V3

```
Track Swap events on USDC/ETH pool 0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640 from block 12376729
```

### Monitor pool liquidity changes

```
Index Mint and Burn events on Uniswap V3 pool 0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640 from block 12376729
```

## NFT Marketplaces

### OpenSea sales

```
Track OrderFulfilled events on Seaport 0x00000000000000ADc04C56Bf30aC9d3c0aAF14dC from block 14946474
```

### Blur marketplace activity

```
Index OrdersMatched on Blur 0x000000000000Ad05Ccc4F10045630fb830B95127 from block 15687719
```

## Token Analytics

### ERC20 transfers

```
Track Transfer events on USDC 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 from block 6082465
```

### Whale token movements

```
Index Transfer events over 1M tokens on USDT 0xdAC17F958D2ee523a2206206994597C13D831ec7 from block 4634748
```

## Governance

### DAO votes

```
Track VoteCast events on Compound Governor 0xc0Da02939E1441F497fd74F78cE7Decb17B66529 from block 12006099
```

### Proposal lifecycle

```
Index ProposalCreated, ProposalExecuted events on Uniswap Governor 0x408ED6354d4973f66138C91495F2f2FCbd8724C3 from block 12686656
```

## Staking & Rewards

### Lido staking

```
Track Submitted events on Lido 0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84 from block 11473216
```

### Rewards claims

```
Index Claimed events on staking contract from deployment block
```

## Bridge Activity

### Cross-chain transfers

```
Track SentMessage events on Optimism Bridge 0x25ace71c97B33Cc4729CF772ae268934F7ab5fA1 from block 12686786
```

## Demo Contract (Sepolia)

### Track all events

```
Index all events on 0xd892de662E18237dfBD080177Ba8cEc4bC6689E7 from block 9679658 on sepolia
```

### Monitor increments

```
create and run a pipe to track the nubmer of incrementation on the contract 0xd892de662E18237dfBD080177Ba8cEc4bC6689E7 from block 9679658 on sepolia
```

### Track user activity

```
Index NumberIncremented, NumberDecremented events on 0xd892de662E18237dfBD080177Ba8cEc4bC6689E7 from block 9679658 on sepolia to see user interactions
```

## Custom Contracts

### Generic event tracking

```
Get events for contract 0x... on mainnet, then index [EventName] from block X
```

### Multiple events

```
Index EventA, EventB, EventC on contract 0x... from block X on sepolia
```

---

## Tips

1. **Find deployment block**: Check contract creation tx on Etherscan for efficient indexing
2. **Proxy contracts**: MCP auto-detects proxies and fetches implementation ABI
3. **Filter events**: Specify exact event names to reduce noise
4. **Network support**: mainnet, sepolia, polygon, arbitrum, optimism, base
