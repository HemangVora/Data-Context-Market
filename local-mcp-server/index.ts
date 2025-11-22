/**
 * MCP Server for uploading and downloading content from Filecoin via the BA-hack server
 * Handles x402 payments automatically when server returns 402 status
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import axios from "axios";
import { config } from "dotenv";
import { Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { withPaymentInterceptor } from "x402-axios";
import { z } from "zod";

config();

const privateKey = process.env.PRIVATE_KEY as Hex;
const baseURL = process.env.RESOURCE_SERVER_URL || "https://ba-hack-production.up.railway.app";

if (!privateKey) {
  throw new Error("PRIVATE_KEY is required for payment handling");
}

const account = privateKeyToAccount(privateKey);

// Axios client with payment interceptor to handle 402 responses
const client = withPaymentInterceptor(axios.create({ baseURL }), account);

// Create an MCP server
const server = new McpServer({
  name: "filecoin-mcp",
  version: "1.0.0",
});

// Hardcoded PieceCID for now
const PIECE_CID = "bafkzcibciacdwydlhwglaeicrliqxxywcbrrol63q3ybv55yw7edjylmqq5pumq";

// Add tool to download content from Filecoin
server.tool(
  "download-from-filecoin",
  "Download content from Filecoin storage. Returns the content along with metadata.",
  {},
  async () => {
    try {
      const res = await client.get("/download", {
        params: { pieceCid: PIECE_CID },
      });
      
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(res.data, null, 2),
          },
        ],
      };
    } catch (error: any) {
      throw new Error(
        `Failed to download from Filecoin: ${error.message || "Unknown error"}`
      );
    }
  },
);

// Add tool to upload content to Filecoin
server.tool(
  "upload-to-filecoin",
  "Upload a message, file, or URL to Filecoin storage. Returns the PieceCID that can be used to download the content later. For files, provide base64-encoded data. For URLs, provide a publicly accessible URL and the server will download, encrypt, and upload the file automatically. IMPORTANT: You MUST ask the user for the required payment metadata fields (description, priceUSD, payAddress) - do NOT infer or guess these values. Always prompt the user explicitly for each required field before calling this tool. The priceUSD will be automatically converted to the correct format internally.",
  {
    message: z.string().optional().describe("Text message to upload to Filecoin"),
    file: z.string().optional().describe("Base64-encoded file data to upload"),
    filename: z.string().optional().describe("Filename (required when uploading a file via base64)"),
    mimeType: z.string().optional().describe("MIME type of the file (e.g., 'application/pdf', 'image/png')"),
    url: z.string().url().optional().describe("URL of a publicly accessible file to download and upload to Filecoin. The server will automatically detect filename and MIME type from the URL or response headers."),
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
    description: string;
    priceUSD: string | number;
    payAddress: string;
  }) => {
    try {
      const { message, file, filename, mimeType, url, description, priceUSD, payAddress } = args;
      
      // Validate required fields
      if (!description) {
        throw new Error("description is required");
      }
      if (priceUSD === undefined || priceUSD === null) {
        throw new Error("priceUSD is required (price in USD, e.g., 0.01 for $0.01)");
      }
      if (!payAddress) {
        throw new Error("payAddress is required (address to receive payments, 0x... for EVM or Solana address)");
      }
      
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
        
        // Convert to 6 decimals: multiply by 1,000,000
        const priceInMicroUSDC = Math.round(priceValue * 1_000_000);
        priceUSDC = priceInMicroUSDC.toString();
      } catch (error: any) {
        throw new Error(`Invalid price format: ${priceUSD}. ${error.message || "Expected a number like 0.01 or '$0.01'"}`);
      }
      
      if (!message && !file && !url) {
        throw new Error("Either message, file, or url parameter is required");
      }

      if (file && !filename) {
        throw new Error("filename is required when uploading a file via base64");
      }

      const payload: any = {};
      if (message) {
        payload.message = message;
      }
      if (file) {
        payload.file = file;
        payload.filename = filename;
        if (mimeType) {
          payload.mimeType = mimeType;
        }
      }
      if (url) {
        payload.url = url;
        // Optional: allow override of filename/mimeType even when using URL
        if (filename) {
          payload.filename = filename;
        }
        if (mimeType) {
          payload.mimeType = mimeType;
        }
      }
      
      // Add required payment metadata (convert priceUSD to priceUSDC)
      payload.description = description;
      payload.priceUSDC = priceUSDC; // Already converted to 6 decimals
      payload.payAddress = payAddress;

      const res = await client.post("/upload", payload);
      
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(res.data, null, 2),
          },
        ],
      };
    } catch (error: any) {
      throw new Error(
        `Failed to upload to Filecoin: ${error.message || "Unknown error"}`
      );
    }
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
