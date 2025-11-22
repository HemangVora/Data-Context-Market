import { ethers } from "ethers";
import { privateKey, sepoliaRpcUrl } from "../config.js";
import contractArtifact from "../contracts/DataBoxRegistry.json";

// Contract address on Sepolia
export const CONTRACT_ADDRESS = contractArtifact.address;

// Contract ABI
const CONTRACT_ABI = contractArtifact.abi;

/**
 * Registers an upload on the DataBoxRegistry smart contract
 * @param pieceCid The PieceCID from Filecoin (used as _textId)
 * @param description Description of the data
 * @param priceUSDC Price in USDC (6 decimals)
 * @param payAddress Address to receive payments
 * @param name Name of the file/data
 * @param filetype File type or MIME type
 * @returns Transaction hash
 */
export async function registerUploadOnContract(
  pieceCid: string,
  description: string,
  priceUSDC: number | string,
  payAddress: string,
  name: string,
  filetype: string,
): Promise<{ txHash: string; blockNumber?: number }> {
  if (!privateKey) {
    throw new Error("PRIVATE_KEY is required for contract interaction");
  }

  // Connect to Sepolia network
  if (!sepoliaRpcUrl) {
    throw new Error("SEPOLIA_RPC_URL is required for contract interaction. Please set it in your .env file.");
  }
  const provider = new ethers.JsonRpcProvider(sepoliaRpcUrl);

  // Create wallet from private key
  const wallet = new ethers.Wallet(privateKey, provider);

  // Get contract instance
  const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, wallet);

  // Convert priceUSDC to BigInt (ensure it's a number/string that can be converted)
  const priceUSDCBigInt =
    typeof priceUSDC === "string" ? BigInt(priceUSDC) : BigInt(priceUSDC);

  console.log(`[CONTRACT] Registering upload on contract:`);
  console.log(`[CONTRACT]   - PieceCID: ${pieceCid}`);
  console.log(`[CONTRACT]   - Description: ${description}`);
  console.log(`[CONTRACT]   - Price: ${priceUSDCBigInt.toString()} USDC (6 decimals)`);
  console.log(`[CONTRACT]   - Pay Address: ${payAddress}`);
  console.log(`[CONTRACT]   - Name: ${name}`);
  console.log(`[CONTRACT]   - Filetype: ${filetype}`);
  console.log(`[CONTRACT]   - Contract: ${CONTRACT_ADDRESS} on Sepolia`);

  try {
    // Call the register_upload function
    const tx = await contract.register_upload(pieceCid, description, priceUSDCBigInt, payAddress, name, filetype);
    console.log(`[CONTRACT] Transaction sent: ${tx.hash}`);
    console.log(`[CONTRACT] Waiting for confirmation...`);

    // Wait for transaction to be mined
    const receipt = await tx.wait();
    console.log(`[CONTRACT] Transaction confirmed in block ${receipt.blockNumber}`);
    console.log(`[CONTRACT] Gas used: ${receipt.gasUsed.toString()}`);

    return {
      txHash: tx.hash,
      blockNumber: receipt.blockNumber,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error(`[CONTRACT] Error calling contract:`, errorMessage);
    throw new Error(`Failed to register upload on contract: ${errorMessage}`);
  }
}

/**
 * Gets data information from the DataBoxRegistry smart contract
 * @param pieceCid The PieceCID to look up
 * @returns Data information including description, priceUSDC, payAddress, name, filetype, and timestamp
 */
export async function getDataFromContract(
  pieceCid: string,
): Promise<{
  description: string;
  priceUSDC: string;
  payAddress: string;
  name: string;
  filetype: string;
  timestamp: bigint;
} | null> {
  if (!sepoliaRpcUrl) {
    throw new Error("SEPOLIA_RPC_URL is required for contract interaction. Please set it in your .env file.");
  }
  const provider = new ethers.JsonRpcProvider(sepoliaRpcUrl);

  // Get contract instance (read-only, no wallet needed)
  const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);

  console.log(`[CONTRACT] Querying contract for PieceCID: ${pieceCid}`);

  try {
    // Check if registered first
    const isRegistered = await contract.isRegistered(pieceCid);
    if (!isRegistered) {
      console.log(`[CONTRACT] PieceCID not found in registry`);
      return null;
    }

    // Get data from contract
    const data = await contract.getData(pieceCid);
    
    console.log(`[CONTRACT] Data retrieved from contract:`);
    console.log(`[CONTRACT]   - Description: ${data[0]}`);
    console.log(`[CONTRACT]   - Price: ${data[1].toString()} USDC (6 decimals)`);
    console.log(`[CONTRACT]   - Pay Address: ${data[2]}`);
    console.log(`[CONTRACT]   - Name: ${data[3]}`);
    console.log(`[CONTRACT]   - Filetype: ${data[4]}`);
    console.log(`[CONTRACT]   - Timestamp: ${data[5].toString()}`);

    return {
      description: data[0],
      priceUSDC: data[1].toString(),
      payAddress: data[2],
      name: data[3],
      filetype: data[4],
      timestamp: data[5],
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    // If the error is "not found", return null
    if (errorMessage.includes("not found") || errorMessage.includes("revert")) {
      console.log(`[CONTRACT] PieceCID not found in registry`);
      return null;
    }
    console.error(`[CONTRACT] Error querying contract:`, errorMessage);
    throw new Error(`Failed to get data from contract: ${errorMessage}`);
  }
}

