# DataBox MCP Server

MCP (Model Context Protocol) server for uploading and downloading content from Filecoin storage via the DataBox server. Automatically handles x402 payments when required.

## Overview

This MCP server provides AI assistants with tools to:
- Upload messages, files, or URLs to Filecoin storage
- Download content from Filecoin using PieceCIDs
- Discover and download datasets by search query

All prices are automatically converted to readable USD format (e.g., "$0.01") for display to users.

## Tools

### 1. `upload-to-filecoin`
Upload content to Filecoin storage.

**Parameters:**
- `message` (optional): Text message to upload
- `file` (optional): Base64-encoded file data
- `filename` (optional): Filename (required when uploading via base64)
- `mimeType` (optional): MIME type of the file
- `url` (optional): URL of a publicly accessible file to download and upload
- `name` (required): Name of the file/data
- `description` (required): Description of the file/data
- `priceUSD` (required): Price in USD (e.g., 0.01 for $0.01)
- `payAddress` (required): Address to receive payments (EVM or Solana)

**Server Route:** `POST /upload`

### 2. `download-from-filecoin`
Download content from Filecoin storage using a PieceCID.

**Parameters:**
- `pieceCid` (required): The PieceCID of the file to download

**Server Route:** `GET /download?pieceCid=<PieceCID>`

### 3. `discover-and-download`
Search for a dataset by query and automatically download it.

**Parameters:**
- `query` (required): Search query to find a dataset

**Server Routes:**
- `GET /discover_query?q=<query>` - Search for matching dataset
- `GET /download?pieceCid=<PieceCID>` - Download the found dataset

## Configuration

Set the following environment variables:

- `PRIVATE_KEY` (required): Ethereum private key for payment handling (hex format: 0x...)
- `RESOURCE_SERVER_URL` (optional): Server URL (defaults to production)

## Features

- **Automatic Payment Handling**: Uses x402-axios to automatically handle 402 payment responses
- **Price Formatting**: Converts USDC amounts to readable USD format for users
- **Input Validation**: Validates PieceCIDs, addresses, base64 data, and prices
- **Error Handling**: Provides clear error messages for network and validation errors
- **Type Safety**: Full TypeScript support with proper interfaces

