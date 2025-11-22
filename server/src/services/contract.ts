import { ethers } from "ethers";
import { privateKey, sepoliaRpcUrl } from "../config.js";
import contractArtifact from "../contracts/BAHack.json";

// Contract address on Sepolia
const CONTRACT_ADDRESS = contractArtifact.address;

// Contract ABI
const CONTRACT_ABI = contractArtifact.abi;

/**
 * Registers an upload on the BAHack smart contract
 * @param pieceCid The PieceCID from Filecoin (used as _textId)
 * @param description Description of the data
 * @param priceUSDC Price in USDC (6 decimals)
 * @param payAddress Address to receive payments
 * @returns Transaction hash
 */
export async function registerUploadOnContract(
  pieceCid: string,
  description: string,
  priceUSDC: number | string,
  payAddress: string,
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
  console.log(`[CONTRACT]   - Contract: ${CONTRACT_ADDRESS} on Sepolia`);

  try {
    // Call the upload function
    const tx = await contract.upload(pieceCid, description, priceUSDCBigInt, payAddress);
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
  } catch (error: any) {
    console.error(`[CONTRACT] Error calling contract:`, error);
    throw new Error(`Failed to register upload on contract: ${error.message || "Unknown error"}`);
  }
}

