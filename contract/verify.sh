#!/bin/bash

# Load environment variables
source .env

# Contract address from deployment
CONTRACT_ADDRESS="0x765BCF8FB2cB266f196fDf0D5C45e609EC2157D8"
NETWORK="baseSepolia"

echo "Verifying BAHack contract on Base Sepolia..."
echo "Contract Address: ${CONTRACT_ADDRESS}"
echo "Network: ${NETWORK}"
echo "=========================================="

# Check if API key is set
if [ -z "$ETHERSCAN_API_KEY" ]; then
    echo "WARNING: ETHERSCAN_API_KEY not set in .env"
    echo "Get your free API key from: https://etherscan.io/myapikey"
    echo "(Works for BaseScan - they use Etherscan API V2)"
    echo ""
    echo "Attempting verification anyway (may fail)..."
fi

# Verify the contract
npx hardhat verify --network ${NETWORK} ${CONTRACT_ADDRESS}

echo ""
echo "=========================================="
echo "If successful, view your contract at:"
echo "https://sepolia.basescan.org/address/${CONTRACT_ADDRESS}"
echo "=========================================="

