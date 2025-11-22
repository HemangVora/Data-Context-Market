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
  "Upload a message or file to Filecoin storage. Returns the PieceCID that can be used to download the content later. For files, provide base64-encoded data.",
  {
    message: z.string().optional().describe("Text message to upload to Filecoin"),
    file: z.string().optional().describe("Base64-encoded file data to upload"),
    filename: z.string().optional().describe("Filename (required when uploading a file)"),
    mimeType: z.string().optional().describe("MIME type of the file (e.g., 'application/pdf', 'image/png')"),
  },
  async (args: { message?: string; file?: string; filename?: string; mimeType?: string }) => {
    try {
      const { message, file, filename, mimeType } = args;
      
      if (!message && !file) {
        throw new Error("Either message or file parameter is required");
      }

      if (file && !filename) {
        throw new Error("filename is required when uploading a file");
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
