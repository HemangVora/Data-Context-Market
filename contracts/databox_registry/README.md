# Smart Contracts - Event Emitter for SQD Indexing

This folder contains the smart contracts for the project, built with Hardhat and designed for event-based indexing with SQD/SubQuery.

## Smart Contract: BAHack.sol

A gas-efficient contract that emits events for off-chain indexing. **No on-chain storage** - all data is captured through events and indexed by SQD.

### Why Event-Only Contract?

- ✅ **Extremely gas-efficient** - No storage costs, only event emission
- ✅ **Perfect for indexing** - All data captured in structured events
- ✅ **Historical data** - Query past events without expensive on-chain storage
- ✅ **Flexible querying** - Use GraphQL to query indexed data
- ✅ **Batch operations** - Emit multiple events in a single transaction

### Events

All events include a `timestamp` field for time-based queries:

#### NumberStored

```solidity
event NumberStored(uint256 indexed number, address indexed by, uint256 timestamp)
```

#### TextStored

```solidity
event TextStored(string text, address indexed by, uint256 timestamp)
```

#### DataStored (Key-Value)

```solidity
event DataStored(string key, string value, address indexed by, uint256 timestamp)
```

#### BalanceUpdated

```solidity
event BalanceUpdated(address indexed user, uint256 balance, address indexed updatedBy, uint256 timestamp)
```

#### NumberIncremented

```solidity
event NumberIncremented(uint256 indexed previousValue, uint256 indexed newValue, uint256 incrementAmount, address indexed by, uint256 timestamp)
```

### Functions

#### Individual Operations

- `storeNumber(uint256 _number)` - Emit a number event
- `storeText(string _text)` - Emit a text event
- `storeData(string _key, string _value)` - Emit a key-value event
- `updateBalance(address _user, uint256 _balance)` - Emit a balance update event
- `incrementNumber(uint256 _previousValue, uint256 _incrementAmount)` - Emit an increment event

#### Batch Operations (Gas Efficient)

- `batchStoreData(string[] _keys, string[] _values)` - Emit multiple key-value events
- `batchUpdateBalances(address[] _users, uint256[] _balances)` - Emit multiple balance events

## Setup

1. **Install dependencies:**

   ```bash
   npm install
   ```

2. **Create .env file:**

   ```bash
   cp env.template .env
   ```

3. **Add your private key to .env:**

   ```
   PRIVATE_KEY=your_private_key_without_0x_prefix
   ```

   ⚠️ **IMPORTANT**: Never commit your `.env` file or share your private key!

## Deployment

### Deploy to Base Sepolia Testnet

```bash
npm run deploy:baseSepolia
```

### Deploy to Base Mainnet

```bash
npm run deploy:base
```

### Deploy to Local Hardhat Network (for testing)

```bash
npm run node
# In another terminal:
npm run deploy:local
```

## Compilation

Compile the smart contracts:

```bash
npm run compile
```

## Testing

Run tests (after creating test files):

```bash
npm run test
```

## Verification

After deployment, the script will automatically attempt to verify the contract on BaseScan. If automatic verification fails, you can verify manually:

```bash
npx hardhat verify --network baseSepolia DEPLOYED_CONTRACT_ADDRESS
```

## Interacting with the Deployed Contract

You can interact with your deployed contract using the interaction script:

```bash
npm run interact:baseSepolia
```

This will emit various events that you can then index with SQD.

### Using Hardhat Console

```bash
npx hardhat console --network baseSepolia
```

Then in the console:

```javascript
const BAHack = await ethers.getContractFactory("BAHack");
const baHack = await BAHack.attach("YOUR_CONTRACT_ADDRESS");

// Emit a number event
const tx1 = await baHack.storeNumber(42);
await tx1.wait();

// Emit text event
const tx2 = await baHack.storeText("Hello, Base!");
await tx2.wait();

// Emit key-value data
const tx3 = await baHack.storeData("name", "My Project");
await tx3.wait();

// Batch emit multiple events (more gas efficient)
const tx4 = await baHack.batchStoreData(
  ["key1", "key2", "key3"],
  ["value1", "value2", "value3"]
);
await tx4.wait();
```

## SQD Integration

See [SQD_INDEXING.md](./SQD_INDEXING.md) for detailed instructions on how to:

- Set up SQD indexer
- Configure event listening
- Create database schemas
- Query indexed data

### Quick SQD Setup

1. After deploying your contract, note the contract address and deployment block number
2. Get the ABI from `artifacts/contracts/BAHack.sol/BAHack.json`
3. Configure your SQD processor to listen to contract events
4. Index events and query via GraphQL

## Network Information

### Base Sepolia Testnet

- **Chain ID**: 84532
- **RPC URL**: https://sepolia.base.org
- **Explorer**: https://sepolia.basescan.org
- **Faucet**: https://www.coinbase.com/faucets/base-ethereum-goerli-faucet
- **SQD Archive**: https://v2.archive.subsquid.io/network/base-sepolia

### Base Mainnet

- **Chain ID**: 8453
- **RPC URL**: https://mainnet.base.org
- **Explorer**: https://basescan.org
- **SQD Archive**: https://v2.archive.subsquid.io/network/base-mainnet

## Getting Testnet ETH

To deploy on Base Sepolia, you'll need testnet ETH:

1. Get Sepolia ETH from a faucet
2. Bridge to Base Sepolia using the [official bridge](https://bridge.base.org/)

Or use the Coinbase Base Faucet directly.

## Gas Costs

Since this contract doesn't use storage, gas costs are minimal:

| Operation                | Approximate Gas                   |
| ------------------------ | --------------------------------- |
| storeNumber              | ~27,000                           |
| storeText                | ~28,000+ (depends on text length) |
| storeData                | ~29,000+ (depends on data size)   |
| updateBalance            | ~28,000                           |
| batchStoreData (3 items) | ~35,000                           |

_Note: Batch operations are significantly more gas-efficient than individual calls._

## Architecture Benefits

### Traditional Storage Contract

- ❌ High gas costs for storage
- ❌ Storage updates cost ~20,000 gas per slot
- ❌ Reading data requires RPC calls
- ❌ Can't query historical data easily

### Event-Only Contract (This Approach)

- ✅ Low gas costs (only event emission)
- ✅ Historical data preserved forever
- ✅ Fast queries via GraphQL
- ✅ Can process and analyze off-chain
- ✅ Perfect for analytics and dashboards

## Deployment Info

Deployment information is automatically saved in the `deployments/` folder after each deployment.

## Useful Commands

```bash
# Compile contracts
npm run compile

# Deploy to Base Sepolia
npm run deploy:baseSepolia

# Interact with deployed contract (emit events)
npm run interact:baseSepolia

# Run local Hardhat node
npm run node

# Deploy to local network (in another terminal)
npm run deploy:local

# Clean build artifacts
npm run clean
```

## Project Structure

```
contracts/
├── contracts/
│   └── BAHack.sol             # Main contract
├── scripts/
│   ├── deploy.js              # Deployment script
│   └── interact.js            # Interaction examples
├── deployments/               # Deployment info (auto-generated)
├── artifacts/                 # Compiled contracts (auto-generated)
├── hardhat.config.js          # Hardhat configuration
├── package.json               # Dependencies and scripts
├── env.template              # Environment variables template
├── README.md                 # This file
├── QUICKSTART.md            # Quick start guide
└── SQD_INDEXING.md          # SQD integration guide
```

## Security Notes

- Never commit your `.env` file
- Keep your private key secure
- Test thoroughly on testnet before mainnet deployment
- Events are permanent and cannot be deleted
- Be mindful of what data you emit (it's public forever)

## Troubleshooting

### "Insufficient funds" error

- Make sure your wallet has enough ETH on Base Sepolia
- Check your balance on https://sepolia.basescan.org

### "Invalid private key" error

- Ensure your private key in `.env` doesn't have the `0x` prefix
- Verify the private key is correct

### RPC connection issues

- Try using a different RPC URL
- Check your internet connection
- Verify the network is accessible

## Resources

- [Hardhat Documentation](https://hardhat.org/docs)
- [Base Documentation](https://docs.base.org)
- [Base Sepolia Testnet](https://docs.base.org/network-information)
- [Solidity Documentation](https://docs.soliditylang.org)
- [SQD Documentation](https://docs.sqd.dev/)
- [Event Indexing Guide](./SQD_INDEXING.md)
