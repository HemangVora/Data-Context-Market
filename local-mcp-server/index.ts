/**
 * MCP Server for downloading content from Filecoin via the BA-hack server
 * Downloads are free and don't require payment authentication
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import axios from "axios";
import { config } from "dotenv";

config();

const baseURL = process.env.RESOURCE_SERVER_URL || "https://ba-hack-production.up.railway.app";

// Regular axios client (no payment interceptor needed for downloads)
const client = axios.create({ baseURL });

// Create an MCP server
const server = new McpServer({
  name: "filecoin-download-mcp",
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

const transport = new StdioServerTransport();
await server.connect(transport);
