/**
 * MCP Server for uploading and downloading content from Filecoin via the BA-hack server
 * Handles x402 payments automatically when server returns 402 status
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import axios, { AxiosError } from "axios";
import { config } from "dotenv";
import { Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { withPaymentInterceptor } from "x402-axios";
import { z } from "zod";

config();

// Type definitions
interface UploadPayload {
  message?: string;
  file?: string;
  filename?: string;
  mimeType?: string;
  url?: string;
  name: string;
  description: string;
  priceUSDC: string;
  payAddress: string;
}

interface UploadResponse {
  success: boolean;
  pieceCid: string;
  size: number;
  type: string;
  name: string;
  filetype: string;
  filename?: string;
  description: string;
  priceUSDC: string;
  payAddress: string;
  dataRegistryTxHash?: string;
  dataRegistryTxUrl?: string;
  dataRegistryBlockNumber?: number;
  message?: string;
}

interface DiscoverResponse {
  success: boolean;
  query: string;
  result?: {
    pieceCid: string;
    name: string;
    description: string;
    price: string; // USDC amount as string
    filetype: string;
  };
}

interface DownloadResponse {
  pieceCid: string;
  size: number;
  format: string;
  type?: string;
  name?: string;
  filetype?: string;
  filename?: string;
  content?: string;
  message?: string;
  [key: string]: unknown;
}

// Validation functions
function validatePrivateKey(key: string | undefined): Hex {
  if (!key) {
    throw new Error("PRIVATE_KEY is required for payment handling");
  }
  
  // Validate hex format: should start with 0x and be 66 characters (0x + 64 hex chars)
  const hexPattern = /^0x[a-fA-F0-9]{64}$/;
  if (!hexPattern.test(key)) {
    throw new Error(
      "PRIVATE_KEY must be a valid hex string: 0x followed by 64 hexadecimal characters (e.g., 0x1234...)"
    );
  }
  
  return key as Hex;
}

function validatePieceCid(pieceCid: string): void {
  if (!pieceCid || pieceCid.trim().length === 0) {
    throw new Error("pieceCid is required and cannot be empty");
  }
  
  // PieceCIDs typically start with 'b' (base32) or 'baga' (base36)
  // This is a basic validation - could be more strict
  if (pieceCid.length < 10) {
    throw new Error(`Invalid PieceCID format: too short. Expected a valid PieceCID (e.g., bafkzcibcaabai3vffxbbuatysolo6sfd23ffr3e5r5t4wbccfootkd2pi6uyupi)`);
  }
}

function validatePayAddress(address: string): void {
  if (!address || address.trim().length === 0) {
    throw new Error("payAddress is required and cannot be empty");
  }
  
  // EVM address: 0x followed by 40 hex characters
  const evmPattern = /^0x[a-fA-F0-9]{40}$/i;
  // Solana address: base58, typically 32-44 characters
  // Basic check: alphanumeric, no 0, O, I, l
  const solanaPattern = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
  
  if (!evmPattern.test(address) && !solanaPattern.test(address)) {
    throw new Error(
      `Invalid payAddress format. Expected an EVM address (0x followed by 40 hex characters) or a Solana address (base58, 32-44 characters). Got: ${address.substring(0, 20)}...`
    );
  }
}

function validateBase64(base64String: string): void {
  if (!base64String || base64String.trim().length === 0) {
    throw new Error("Base64 file data cannot be empty");
  }
  
  // Basic base64 validation: should only contain base64 characters and padding
  const base64Pattern = /^[A-Za-z0-9+/]*={0,2}$/;
  if (!base64Pattern.test(base64String)) {
    throw new Error("Invalid base64 format. File data must be valid base64-encoded");
  }
}

function validatePrice(priceValue: number): void {
  if (isNaN(priceValue)) {
    throw new Error("Price must be a valid number");
  }
  
  if (priceValue < 0) {
    throw new Error("Price cannot be negative");
  }
}

// Error handling utilities
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  if (axios.isAxiosError(error)) {
    if (error.response) {
      // Server responded with error status
      const status = error.response.status;
      const data = error.response.data;
      const message = typeof data === "object" && data !== null && "message" in data
        ? String(data.message)
        : `Server error (${status})`;
      return message;
    } else if (error.request) {
      // Request was made but no response received
      return "Network error: No response from server. Please check your connection and try again.";
    } else {
      // Error setting up the request
      return `Request error: ${error.message}`;
    }
  }
  return "Unknown error occurred";
}

function isNetworkError(error: unknown): boolean {
  if (axios.isAxiosError(error)) {
    return !error.response && !!error.request;
  }
  return false;
}

const privateKey = validatePrivateKey(process.env.PRIVATE_KEY);
const baseURL = process.env.RESOURCE_SERVER_URL || "https://ba-hack-production.up.railway.app";

const account = privateKeyToAccount(privateKey);

// Axios client with payment interceptor and timeout configuration
const client = withPaymentInterceptor(
  axios.create({
    baseURL,
    timeout: 60000, // 60 second timeout
    headers: {
      "Content-Type": "application/json",
    },
  }),
  account
);

/**
 * Converts USDC amount (6 decimals) to a readable USD format string
 * Example: "1000000" -> "$1.00", "10000" -> "$0.01"
 * IMPORTANT: Always use this function when displaying prices to users
 * NEVER display raw USDC amounts - always convert to readable USD format
 */
function formatPriceUSD(priceUSDC: string | number): string {
  const priceNum = typeof priceUSDC === "string" ? parseFloat(priceUSDC) : priceUSDC;
  if (isNaN(priceNum) || priceNum < 0) {
    return "$0.00";
  }
  // Convert from 6 decimals to USD
  const priceInUSD = priceNum / 1_000_000;
  // Format to 2 decimal places, but show more if needed (e.g., $0.000001)
  const decimals = priceInUSD < 0.01 ? 6 : 2;
  return `$${priceInUSD.toFixed(decimals)}`;
}

// Create an MCP server
const server = new McpServer({
  name: "filecoin-mcp",
  version: "1.0.0",
});

// Add tool to download content from Filecoin
server.tool(
  "download-from-filecoin",
  "Download content from Filecoin storage using a PieceCID. Returns the content along with metadata including description, price, and payment address if available. IMPORTANT: Prices are always returned in readable USD format (e.g., '$0.01' for 1 cent, '$1.00' for 1 dollar) - never display raw USDC amounts to users.",
  {
    pieceCid: z.string().describe("The PieceCID of the file to download from Filecoin (e.g., 'bafkzcibciacdwydlhwglaeicrliqxxywcbrrol63q3ybv55yw7edjylmqq5pumq')"),
  },
  async (args: { pieceCid: string }) => {
    try {
      const { pieceCid } = args;
      
      // Validate PieceCID format
      validatePieceCid(pieceCid);
      
      const res = await client.get<DownloadResponse>("/download", {
        params: { pieceCid },
      });
      
      // Format price if present in response
      const responseData: DownloadResponse & { priceUSD?: string } = { ...res.data };
      if (responseData.priceUSDC && typeof responseData.priceUSDC === "string") {
        responseData.priceUSD = formatPriceUSD(responseData.priceUSDC);
      }
      
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(responseData, null, 2),
          },
        ],
      };
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error);
      if (isNetworkError(error)) {
        throw new Error(`Network error while downloading from Filecoin: ${errorMessage}`);
      }
      throw new Error(`Failed to download from Filecoin: ${errorMessage}`);
    }
  },
);

// Add tool to upload content to Filecoin
server.tool(
  "upload-to-filecoin",
  "Upload a message, file, or URL to Filecoin storage. Returns the PieceCID that can be used to download the content later. For files, provide base64-encoded data. For URLs, provide a publicly accessible URL and the server will download, encrypt, and upload the file automatically. The filetype will be automatically deduced from the mimeType or filename. IMPORTANT: You MUST ask the user for the required fields (name, description, priceUSD, payAddress) - do NOT infer or guess these values. Always prompt the user explicitly for each required field before calling this tool. The priceUSD will be automatically converted to the correct format internally.",
  {
    message: z.string().optional().describe("Text message to upload to Filecoin"),
    file: z.string().optional().describe("Base64-encoded file data to upload"),
    filename: z.string().optional().describe("Filename (required when uploading a file via base64)"),
    mimeType: z.string().optional().describe("MIME type of the file (e.g., 'application/pdf', 'image/png'). If not provided, will be deduced from filename extension."),
    url: z.string().url().optional().describe("URL of a publicly accessible file to download and upload to Filecoin. The server will automatically detect filename and MIME type from the URL or response headers."),
    name: z.string().describe("REQUIRED: Name of the file/data. You MUST ask the user for this value - do not infer it. Ask: 'What name should this file/data have?'"),
    description: z.string().describe("REQUIRED: Description of what the file/data is. You MUST ask the user for this value - do not infer it. Ask: 'What is a description of this file/data?'"),
    priceUSD: z.union([z.string(), z.number()]).describe("REQUIRED: Price in USD as a decimal number (e.g., 0.01 for $0.01, 1.5 for $1.50, or '0.01' as string). You can also accept formats like '$0.01'. You MUST ask the user for this value - do not infer or guess. Ask: 'What price in USD should this be? (e.g., 0.01 for $0.01)'"),
    payAddress: z.string().describe("REQUIRED: Address to receive payments (0x... for EVM or Solana address). You MUST ask the user for this value - do not infer it. Ask: 'What address should receive payments for this? (0x... for EVM or Solana address)'"),
  },
  async (args: { 
    message?: string; 
    file?: string; 
    filename?: string; 
    mimeType?: string; 
    url?: string;
    name: string;
    description: string;
    priceUSD: string | number;
    payAddress: string;
  }) => {
    try {
      const { message, file, filename, mimeType, url, name, description, priceUSD, payAddress } = args;
      
      // Validate inputs (Zod already validates required fields, but we add format validation)
      if (name.trim().length === 0) {
        throw new Error("name cannot be empty");
      }
      if (description.trim().length === 0) {
        throw new Error("description cannot be empty");
      }
      
      // Validate payment address format
      validatePayAddress(payAddress);
      
      // Convert priceUSD to priceUSDC (6 decimals)
      // Accept formats like: 0.01, "0.01", "$0.01", 1.5, etc.
      let priceUSDC: string;
      try {
        let priceValue: number;
        if (typeof priceUSD === "string") {
          // Remove $ sign if present and trim whitespace
          const cleaned = priceUSD.replace(/^\$/, "").trim();
          priceValue = parseFloat(cleaned);
          if (isNaN(priceValue)) {
            throw new Error(`Invalid price format: ${priceUSD}. Expected a number like 0.01 or "$0.01"`);
          }
        } else {
          priceValue = priceUSD;
        }
        
        // Validate price (non-negative)
        validatePrice(priceValue);
        
        // Convert to 6 decimals: multiply by 1,000,000
        const priceInMicroUSDC = Math.round(priceValue * 1_000_000);
        priceUSDC = priceInMicroUSDC.toString();
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        throw new Error(`Invalid price format: ${priceUSD}. ${errorMessage}`);
      }
      
      if (!message && !file && !url) {
        throw new Error("Either message, file, or url parameter is required");
      }

      if (file) {
        if (!filename) {
        throw new Error("filename is required when uploading a file via base64");
        }
        // Validate base64 format
        validateBase64(file);
      }

      const payload: UploadPayload = {
        name: name.trim(),
        description: description.trim(),
        priceUSDC,
        payAddress,
      };
      if (message) {
        payload.message = message.trim();
      }
      if (file) {
        payload.file = file;
        payload.filename = filename!;
        if (mimeType) {
          payload.mimeType = mimeType.trim();
        }
      }
      if (url) {
        payload.url = url.trim();
        // Optional: allow override of filename/mimeType even when using URL
        if (filename) {
          payload.filename = filename.trim();
        }
        if (mimeType) {
          payload.mimeType = mimeType.trim();
        }
      }
      
      // Note: filetype is automatically deduced by the server from mimeType or filename

      const res = await client.post<UploadResponse>("/upload", payload);
      
      // Format price for display (convert USDC to readable USD)
      const responseData: UploadResponse & { priceUSD?: string } = { ...res.data };
      if (responseData.priceUSDC) {
        responseData.priceUSD = formatPriceUSD(responseData.priceUSDC);
      }
      
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(responseData, null, 2),
          },
        ],
      };
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error);
      if (isNetworkError(error)) {
        throw new Error(`Network error while uploading to Filecoin: ${errorMessage}`);
      }
      throw new Error(`Failed to upload to Filecoin: ${errorMessage}`);
    }
  },
);

// Add tool to discover and download content from Filecoin
server.tool(
  "discover-and-download",
  "Search for a dataset by query and automatically download it. First searches the registry for a matching dataset, then downloads the content. Returns both the discovery metadata and the downloaded content. IMPORTANT: Prices are always returned in readable USD format (e.g., '$0.01' for 1 cent, '$1.00' for 1 dollar) - never display raw USDC amounts to users.",
  {
    query: z.string().describe("REQUIRED: Search query to find a dataset. This will search in dataset names and descriptions. You MUST ask the user what they are looking for. Ask: 'What dataset are you looking for?'"),
  },
  async (args: { query: string }) => {
    try {
      const { query } = args;
      
      if (!query || query.trim().length === 0) {
        throw new Error("query is required and cannot be empty");
      }
      
      const trimmedQuery = query.trim();
      
      // Step 1: Discover the dataset
      let discoverRes;
      try {
        discoverRes = await client.get<DiscoverResponse>("/discover_query", {
          params: { q: trimmedQuery },
        });
      } catch (error: unknown) {
        // Handle 404 from discover_query endpoint
        if (axios.isAxiosError(error) && error.response?.status === 404) {
          const errorData = error.response?.data;
          const message = typeof errorData === "object" && errorData !== null && "message" in errorData
            ? String(errorData.message)
            : `No dataset found matching the query "${trimmedQuery}"`;
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  success: false,
                  query: trimmedQuery,
                  message: message,
                  error: "No matching dataset found",
                }, null, 2),
              },
            ],
          };
        }
        // Re-throw other errors to be handled below
        throw error;
      }
      
      if (!discoverRes.data.success || !discoverRes.data.result) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: false,
                query: trimmedQuery,
                message: `No dataset found matching the query "${trimmedQuery}"`,
                error: "No matching dataset found",
              }, null, 2),
            },
          ],
        };
      }
      
      const discoveredDataset = discoverRes.data.result;
      
      // Validate PieceCID before downloading
      validatePieceCid(discoveredDataset.pieceCid);
      
      // Step 2: Download the dataset using the pieceCid
      const downloadRes = await client.get<DownloadResponse>("/download", {
        params: { pieceCid: discoveredDataset.pieceCid },
      });
      
      // Format price for display (convert USDC to readable USD)
      const formattedPrice = formatPriceUSD(discoveredDataset.price);
      
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: true,
              discovery: {
                query: trimmedQuery,
                dataset: {
                  pieceCid: discoveredDataset.pieceCid,
                  name: discoveredDataset.name,
                  description: discoveredDataset.description,
                  price: formattedPrice, // Always display in readable USD format
                  filetype: discoveredDataset.filetype,
                },
              },
              download: downloadRes.data,
            }, null, 2),
          },
        ],
      };
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error);
      if (isNetworkError(error)) {
        throw new Error(`Network error while discovering and downloading: ${errorMessage}`);
      }
      throw new Error(`Failed to discover and download: ${errorMessage}`);
    }
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
