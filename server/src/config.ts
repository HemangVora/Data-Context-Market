import { config } from "dotenv";
import { Resource, type SolanaAddress } from "x402-express";

config();

/**
 * Validates and returns environment variable, throws if missing
 */
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`❌ Missing required environment variable: ${name}`);
    process.exit(1);
  }
  return value;
}

/**
 * Validates and returns optional environment variable with default
 */
function optionalEnv(name: string, defaultValue: string): string {
  return process.env[name] || defaultValue;
}

// Required environment variables
export const facilitatorUrl = requireEnv("FACILITATOR_URL") as Resource;
export const payTo = requireEnv("ADDRESS") as `0x${string}` | SolanaAddress;

// Optional environment variables with defaults
export const port = parseInt(optionalEnv("PORT", "4021"), 10);
export const clickhouseUrl = optionalEnv("CLICKHOUSE_URL", "http://localhost:8123");
export const clickhouseUser = optionalEnv("CLICKHOUSE_USER", "default");
export const clickhousePassword = optionalEnv("CLICKHOUSE_PASSWORD", "password");

// Optional environment variables (may be undefined)
export const privateKey = process.env.PRIVATE_KEY;
export const rpcUrl = process.env.RPC_URL;
export const sepoliaRpcUrl = process.env.SEPOLIA_RPC_URL;

// Validate port is a valid number
if (isNaN(port) || port < 1 || port > 65535) {
  console.error(`❌ Invalid PORT: ${process.env.PORT}. Must be a number between 1 and 65535`);
  process.exit(1);
}

// Validate facilitator URL format
try {
  new URL(facilitatorUrl);
} catch {
  console.error(`❌ Invalid FACILITATOR_URL format: ${facilitatorUrl}`);
  process.exit(1);
}

// Validate pay address format (basic check)
const evmPattern = /^0x[a-fA-F0-9]{40}$/i;
const solanaPattern = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
if (!evmPattern.test(payTo) && !solanaPattern.test(payTo)) {
  console.error(`❌ Invalid ADDRESS format. Expected EVM (0x...) or Solana address. Got: ${payTo.substring(0, 20)}...`);
  process.exit(1);
}

console.log("✓ Environment variables validated");

