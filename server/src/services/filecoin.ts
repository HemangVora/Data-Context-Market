import { Synapse, RPC_URLS } from "@filoz/synapse-sdk";
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { privateKey, rpcUrl } from "../config.js";

// Valid dummy key for downloads (when private key not needed)
const DUMMY_KEY = "0x0000000000000000000000000000000000000000000000000000000000000001";

// Encryption constants
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96 bits for GCM
const AUTH_TAG_LENGTH = 16; // 128 bits

/**
 * Derives encryption key from private key
 */
function getEncryptionKey(): Buffer {
  if (!privateKey || privateKey === "your_private_key_here") {
    throw new Error("PRIVATE_KEY is required for encryption");
  }
  
  // Remove 0x prefix and convert to buffer (32 bytes for AES-256)
  const keyHex = privateKey.startsWith("0x") ? privateKey.slice(2) : privateKey;
  return Buffer.from(keyHex, "hex");
}

/**
 * Encrypts data using AES-256-GCM
 */
function encryptData(data: Uint8Array): Uint8Array {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(data),
    cipher.final(),
  ]);
  
  const authTag = cipher.getAuthTag();
  
  // Return: IV (12 bytes) + AuthTag (16 bytes) + Encrypted data
  const result = new Uint8Array(IV_LENGTH + AUTH_TAG_LENGTH + encrypted.length);
  result.set(iv, 0);
  result.set(authTag, IV_LENGTH);
  result.set(encrypted, IV_LENGTH + AUTH_TAG_LENGTH);
  
  return result;
}

/**
 * Decrypts data using AES-256-GCM
 */
function decryptData(encryptedData: Uint8Array): Uint8Array {
  const key = getEncryptionKey();
  
  // Extract IV, auth tag, and encrypted data
  const iv = encryptedData.slice(0, IV_LENGTH);
  const authTag = encryptedData.slice(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const encrypted = encryptedData.slice(IV_LENGTH + AUTH_TAG_LENGTH);
  
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  
  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);
  
  return new Uint8Array(decrypted);
}

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
  format: "text" | "binary" | "file";
  content: string;
  filename?: string;
  mimeType?: string;
  message?: string;
}> {
  const synapse = await getSynapse(false);
  const encryptedBytes = await synapse.storage.download(pieceCid);

  // Decrypt the data
  let bytes: Uint8Array;
  try {
    bytes = decryptData(encryptedBytes);
  } catch (error) {
    // If decryption fails, return as binary (might be old unencrypted data)
    const base64Content = Buffer.from(encryptedBytes).toString("base64");
    return {
      pieceCid,
      size: encryptedBytes.length,
      format: "binary",
      content: base64Content,
      message: "Failed to decrypt. Data might be unencrypted or corrupted.",
    };
  }

  // Remove padding (trailing null bytes)
  let trimmedBytes = bytes;
  let lastNonZero = bytes.length - 1;
  while (lastNonZero >= 0 && bytes[lastNonZero] === 0) {
    lastNonZero--;
  }
  if (lastNonZero < bytes.length - 1) {
    trimmedBytes = bytes.slice(0, lastNonZero + 1);
  }

  // Check if there's metadata header (JSON at the start)
  try {
    const textDecoder = new TextDecoder();
    const firstChars = textDecoder.decode(trimmedBytes.slice(0, Math.min(100, trimmedBytes.length)));
    
    if (firstChars.startsWith("{")) {
      // Try to parse as JSON metadata
      const jsonEnd = firstChars.indexOf("}");
      if (jsonEnd > 0) {
        const metadataStr = firstChars.slice(0, jsonEnd + 1);
        const metadata = JSON.parse(metadataStr);
        
        if (metadata.type === "file" && metadata.filename) {
          // It's a file, extract the file data
          const metadataBytes = new TextEncoder().encode(metadataStr);
          const fileData = trimmedBytes.slice(metadataBytes.length);
          const base64Content = Buffer.from(fileData).toString("base64");
          
          return {
            pieceCid,
            size: fileData.length,
            format: "file",
            content: base64Content,
            filename: metadata.filename,
            mimeType: metadata.mimeType || "application/octet-stream",
          };
        }
      }
    }
  } catch (error) {
    // Not JSON metadata, continue with text/binary detection
  }

  // Try to decode as text
  try {
    const decodedText = new TextDecoder().decode(trimmedBytes);
    return {
      pieceCid,
      size: trimmedBytes.length,
      format: "text",
      content: decodedText,
    };
  } catch (error) {
    // If it's not text, return as base64
    const base64Content = Buffer.from(trimmedBytes).toString("base64");
    return {
      pieceCid,
      size: trimmedBytes.length,
      format: "binary",
      content: base64Content,
      message: "Content is binary, returned as base64. Decode to get original bytes.",
    };
  }
}

/**
 * Gets the file size from Filecoin without returning the content.
 * This is used for pricing calculation before payment.
 */
export async function getFileSizeFromFilecoin(pieceCid: string): Promise<number> {
  console.log(`[FILE_SIZE] Starting file size fetch for PieceCID: ${pieceCid}`);
  const synapse = await getSynapse(false);
  
  console.log(`[FILE_SIZE] Downloading encrypted bytes from Filecoin...`);
  const encryptedBytes = await synapse.storage.download(pieceCid);
  console.log(`[FILE_SIZE] Encrypted bytes downloaded: ${encryptedBytes.length} bytes`);

  // Decrypt the data to get actual size
  let bytes: Uint8Array;
  try {
    console.log(`[FILE_SIZE] Decrypting data...`);
    bytes = decryptData(encryptedBytes);
    console.log(`[FILE_SIZE] Decrypted bytes: ${bytes.length} bytes`);
  } catch (error) {
    // If decryption fails, return encrypted size as fallback
    console.warn(`[FILE_SIZE] Decryption failed, using encrypted size as fallback: ${encryptedBytes.length} bytes`);
    return encryptedBytes.length;
  }

  // Remove padding (trailing null bytes)
  let trimmedBytes = bytes;
  let lastNonZero = bytes.length - 1;
  while (lastNonZero >= 0 && bytes[lastNonZero] === 0) {
    lastNonZero--;
  }
  if (lastNonZero < bytes.length - 1) {
    trimmedBytes = bytes.slice(0, lastNonZero + 1);
    console.log(`[FILE_SIZE] Removed ${bytes.length - trimmedBytes.length} bytes of padding`);
  }

  // Check if there's metadata header (JSON at the start)
  try {
    const textDecoder = new TextDecoder();
    const firstChars = textDecoder.decode(trimmedBytes.slice(0, Math.min(100, trimmedBytes.length)));
    
    if (firstChars.startsWith("{")) {
      // Try to parse as JSON metadata
      const jsonEnd = firstChars.indexOf("}");
      if (jsonEnd > 0) {
        const metadataStr = firstChars.slice(0, jsonEnd + 1);
        const metadata = JSON.parse(metadataStr);
        
        if (metadata.type === "file" && metadata.filename) {
          // It's a file, return the file data size (excluding metadata)
          const metadataBytes = new TextEncoder().encode(metadataStr);
          const fileDataSize = trimmedBytes.length - metadataBytes.length;
          console.log(`[FILE_SIZE] Detected file with metadata. File data size: ${fileDataSize} bytes (metadata: ${metadataBytes.length} bytes)`);
          return fileDataSize;
        }
      }
    }
  } catch (error) {
    // Not JSON metadata, continue
    console.log(`[FILE_SIZE] No JSON metadata detected, using full trimmed size`);
  }

  // Return the trimmed size
  console.log(`[FILE_SIZE] Final file size: ${trimmedBytes.length} bytes`);
  return trimmedBytes.length;
}

export async function uploadToFilecoin(
  data: string | Uint8Array,
  options?: { filename?: string; mimeType?: string }
): Promise<{
  pieceCid: string;
  size: number;
}> {
  const synapse = await getSynapse(true);
  
  let dataBytes: Uint8Array;
  
  // If it's a file (has filename), add metadata header
  if (options?.filename && data instanceof Uint8Array) {
    const metadata = {
      type: "file",
      filename: options.filename,
      mimeType: options.mimeType || "application/octet-stream",
    };
    const metadataStr = JSON.stringify(metadata);
    const metadataBytes = new TextEncoder().encode(metadataStr);
    
    // Combine metadata + file data
    dataBytes = new Uint8Array(metadataBytes.length + data.length);
    dataBytes.set(metadataBytes, 0);
    dataBytes.set(data, metadataBytes.length);
  } else if (typeof data === "string") {
    // It's a text message
    dataBytes = new TextEncoder().encode(data);
  } else {
    // It's binary data without filename
    dataBytes = data;
  }
  
  // Encrypt the data first
  const encryptedData = encryptData(dataBytes);
  
  // Filecoin requires minimum 127 bytes, pad if needed
  const MIN_SIZE = 127;
  let paddedData = encryptedData;
  
  if (encryptedData.length < MIN_SIZE) {
    // Pad with null bytes (0x00)
    paddedData = new Uint8Array(MIN_SIZE);
    paddedData.set(encryptedData, 0);
    // Rest is already zeros (default Uint8Array initialization)
  }
  
  const { pieceCid, size } = await synapse.storage.upload(paddedData);
  return { pieceCid: pieceCid.toString(), size };
}

