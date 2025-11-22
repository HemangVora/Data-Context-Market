# Quick Start Guide - Deploy to Base Sepolia

Follow these simple steps to deploy your smart contract to Base Sepolia testnet.

## Prerequisites

- Node.js installed
- A wallet with Base Sepolia testnet ETH
- Your wallet's private key

## Step 1: Install Dependencies

Already done! If you need to reinstall:

```bash
npm install
```

## Step 2: Set Up Environment Variables

1. Create a `.env` file in the contracts folder:

```bash
touch .env
```

2. Add your private key to the `.env` file:

```
PRIVATE_KEY=your_private_key_without_0x_prefix
```

**IMPORTANT:**

- Remove the `0x` prefix from your private key
- Never commit or share your `.env` file
- The `.env` file is already in `.gitignore`

## Step 3: Get Testnet ETH

You need Base Sepolia ETH to deploy. Get it from:

1. **Coinbase Base Faucet**: https://www.coinbase.com/faucets/base-ethereum-goerli-faucet
2. **Or bridge from Sepolia**: https://bridge.base.org/

## Step 4: Deploy the Contract

Run the deployment command:

```bash
npm run deploy:baseSepolia
```

You should see output like:

```
Deploying BAHack contract to Base Sepolia...
Deploying contracts with account: 0x...
Account balance: 0.1 ETH
BAHack contract deployed to: 0x...
```

The deployment information will be saved in `deployments/baseSepolia.json`

## Step 5: Verify on BaseScan (Optional)

The deploy script will automatically try to verify your contract. If it fails, you can verify manually:

1. Get a BaseScan API key from: https://basescan.org/myapikey
2. Add it to your `.env`:
   ```
   BASESCAN_API_KEY=your_api_key
   ```
3. Run verification:
   ```bash
   npx hardhat verify --network baseSepolia YOUR_CONTRACT_ADDRESS
   ```

## Step 6: Interact with Your Contract

Use the interaction script to test your contract:

```bash
npm run interact:baseSepolia
```

This will:

- Store a number (42)
- Store text ("Hello, Base Sepolia!")
- Store key-value data
- Update balances
- Retrieve all stored values

## Alternative: Using Hardhat Console

For manual interaction:

```bash
npx hardhat console --network baseSepolia
```

Then in the console:

```javascript
const BAHack = await ethers.getContractFactory("BAHack");
const baHack = await BAHack.attach("YOUR_CONTRACT_ADDRESS");

// Emit a number event
await baHack.storeNumber(42);

// Emit text event
await baHack.storeText("Hello!");
```

## Contract Functions

Your deployed contract has these functions:

### Storage Functions

- `storeNumber(uint256)` - Store a number
- `retrieveNumber()` - Get the stored number
- `storeText(string)` - Store text
- `retrieveText()` - Get the stored text
- `storeData(string, string)` - Store key-value pairs
- `retrieveData(string)` - Get value by key

### Balance Functions

- `updateBalance(address, uint256)` - Update user balance
- `getBalance(address)` - Get user balance

### Utility Functions

- `incrementNumber(uint256)` - Increment the stored number
- `resetNumber()` - Reset number to zero (owner only)
- `getOwner()` - Get contract owner

## Useful Commands

```bash
# Compile contracts
npm run compile

# Deploy to Base Sepolia
npm run deploy:baseSepolia

# Interact with deployed contract
npm run interact:baseSepolia

# Run local Hardhat node
npm run node

# Deploy to local network (in another terminal)
npm run deploy:local

# Clean build artifacts
npm run clean
```

## View Your Contract

After deployment, view your contract on:

- **Base Sepolia Explorer**: https://sepolia.basescan.org

Just search for your contract address!

## Troubleshooting

### "Insufficient funds"

- Make sure you have enough Base Sepolia ETH
- Check balance at https://sepolia.basescan.org

### "Invalid private key"

- Ensure no `0x` prefix in your private key
- Verify the key is correct

### "Network not available"

- Check your internet connection
- Try a different RPC URL in hardhat.config.js

## Next Steps

- Modify the `Storage.sol` contract for your needs
- Add tests in the `test/` folder
- Deploy to Base Mainnet when ready (use `npm run deploy:base`)

## Need Help?

- [Hardhat Documentation](https://hardhat.org/docs)
- [Base Documentation](https://docs.base.org)
- [Solidity Documentation](https://docs.soliditylang.org)
