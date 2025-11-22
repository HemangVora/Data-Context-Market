import { Synapse, RPC_URLS } from "@filoz/synapse-sdk";
import { privateKey, rpcUrl } from "../config.js";

// Valid dummy key for downloads (when private key not needed)
const DUMMY_KEY = "0x0000000000000000000000000000000000000000000000000000000000000001";

async function getSynapse(requirePrivateKey: boolean = false): Promise<Synapse> {
  const key = privateKey || DUMMY_KEY;
  
  if (requirePrivateKey && (!privateKey || privateKey === "your_private_key_here")) {
    throw new Error("PRIVATE_KEY is required for this operation");
  }

  return await Synapse.create({
    privateKey: key,
    rpcURL: rpcUrl || RPC_URLS.calibration.http,
  });
}

export async function downloadFromFilecoin(pieceCid: string): Promise<{
  pieceCid: string;
  size: number;
  format: "text" | "binary";
  content: string;
  message?: string;
}> {
  const synapse = await getSynapse(false);
  const bytes = await synapse.storage.download(pieceCid);

  // Try to decode as text
  try {
    const decodedText = new TextDecoder().decode(bytes);
    return {
      pieceCid,
      size: bytes.length,
      format: "text",
      content: decodedText,
    };
  } catch (error) {
    // If it's not text, return as base64
    const base64Content = Buffer.from(bytes).toString("base64");
    return {
      pieceCid,
      size: bytes.length,
      format: "binary",
      content: base64Content,
      message: "Content is binary, returned as base64. Decode to get original bytes.",
    };
  }
}

export async function uploadToFilecoin(message: string): Promise<{
  pieceCid: string;
  size: number;
}> {
  const synapse = await getSynapse(true);
  const data = new TextEncoder().encode(message);
  const { pieceCid, size } = await synapse.storage.upload(data);
  return { pieceCid, size };
}

