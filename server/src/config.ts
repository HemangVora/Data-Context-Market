import { config } from "dotenv";
import { Resource, type SolanaAddress } from "x402-express";

config();

export const facilitatorUrl = process.env.FACILITATOR_URL as Resource;
export const payTo = process.env.ADDRESS as `0x${string}` | SolanaAddress;
export const port = process.env.PORT || 4021;
export const privateKey = process.env.PRIVATE_KEY;
export const rpcUrl = process.env.RPC_URL;
export const sepoliaRpcUrl = process.env.SEPOLIA_RPC_URL;

if (!facilitatorUrl || !payTo) {
  console.error("Missing required environment variables");
  process.exit(1);
}

