/**
 * Type definitions for the server
 */

// Request extensions (added by middleware)
import { Request } from "express";

export interface RequestWithContractData extends Request {
  contractData?: ContractData;
  dynamicPrice?: string;
}

export interface ContractData {
  description: string;
  priceUSDC: string;
  payAddress: string;
  name: string;
  filetype: string;
  timestamp: bigint;
}

export interface DownloadResult {
  pieceCid: string;
  size: number;
  format: "text" | "binary" | "file";
  content: string;
  filename?: string;
  mimeType?: string;
  description?: string;
  priceUSDC?: string;
  payAddress?: string;
  name?: string;
  filetype?: string;
  type?: string;
  message?: string;
}

export interface UploadRequestBody {
  message?: string;
  file?: string;
  filename?: string;
  mimeType?: string;
  url?: string;
  name: string;
  description: string;
  priceUSDC: number | string;
  payAddress: string;
}

export interface ErrorResponse {
  error: string;
  message: string;
  [key: string]: unknown;
}

