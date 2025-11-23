import { Synapse, RPC_URLS } from "@filoz/synapse-sdk";
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { privateKey, rpcUrl } from "../config.js";

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
  const keyBuffer = Buffer.from(keyHex, "hex");
  
  // Log first and last 4 bytes of key for debugging (not the full key for security)
  const keyPreview = `${keyBuffer.slice(0, 4).toString('hex')}...${keyBuffer.slice(-4).toString('hex')}`;
  console.log(`[ENCRYPTION_KEY] Using key (preview): ${keyPreview} (length: ${keyBuffer.length} bytes)`);
  
  if (keyBuffer.length !== 32) {
    throw new Error(`Invalid encryption key length: ${keyBuffer.length} bytes (expected 32 bytes for AES-256)`);
  }
  
  return keyBuffer;
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
  console.log(`[DECRYPT] Starting decryption of ${encryptedData.length} bytes`);
  
  const key = getEncryptionKey();
  console.log(`[DECRYPT] Using encryption key (length: ${key.length} bytes)`);
  
  // Extract IV, auth tag, and encrypted data
  const iv = encryptedData.slice(0, IV_LENGTH);
  const authTag = encryptedData.slice(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const encrypted = encryptedData.slice(IV_LENGTH + AUTH_TAG_LENGTH);
  
  console.log(`[DECRYPT] Extracted IV: ${iv.length} bytes, AuthTag: ${authTag.length} bytes, Encrypted: ${encrypted.length} bytes`);
  
  try {
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);
    
    console.log(`[DECRYPT] ✓ Successfully decrypted to ${decrypted.length} bytes`);
    return new Uint8Array(decrypted);
  } catch (error: any) {
    console.error(`[DECRYPT] ✗ Decryption error:`, error.message);
    if (error.message?.includes("unable to authenticate") || error.message?.includes("Unsupported state")) {
      console.error(`[DECRYPT] ⚠ This usually means the encryption key doesn't match the one used to encrypt the data.`);
      console.error(`[DECRYPT] ⚠ Check that PRIVATE_KEY matches the key used when the file was uploaded.`);
    }
    throw error;
  }
}

async function getSynapse(): Promise<Synapse> {
  if (!privateKey || privateKey === "your_private_key_here") {
    throw new Error("PRIVATE_KEY is required for Filecoin operations");
  }

  return await Synapse.create({
    privateKey: privateKey,
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
  description?: string;
  priceUSDC?: string;
  payAddress?: string;
  name?: string;
  filetype?: string;
  type?: string;
  message?: string;
}> {
  console.log(`[FILEcoin] Starting download for PieceCID: ${pieceCid}`);
  const synapse = await getSynapse();
  
  console.log(`[FILEcoin] Downloading encrypted bytes from Filecoin...`);
  const encryptedBytes = await synapse.storage.download(pieceCid);
  console.log(`[FILEcoin] Downloaded ${encryptedBytes.length} encrypted bytes`);

  // Decrypt the data
  let bytes: Uint8Array;
  try {
    console.log(`[FILEcoin] Attempting to decrypt data...`);
    console.log(`[FILEcoin] Encrypted data structure: IV (${IV_LENGTH} bytes) + AuthTag (${AUTH_TAG_LENGTH} bytes) + Encrypted data`);
    console.log(`[FILEcoin] Total encrypted length: ${encryptedBytes.length} bytes`);
    
    if (encryptedBytes.length < IV_LENGTH + AUTH_TAG_LENGTH) {
      throw new Error(`Encrypted data too short: ${encryptedBytes.length} bytes (minimum ${IV_LENGTH + AUTH_TAG_LENGTH} bytes required)`);
    }
    
    bytes = decryptData(encryptedBytes);
    console.log(`[FILEcoin] ✓ Successfully decrypted ${bytes.length} bytes`);
  } catch (error: any) {
    console.error(`[FILEcoin] ✗ Decryption failed:`, error.message);
    console.error(`[FILEcoin] Error stack:`, error.stack);
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

  // Smart padding removal: Check if data starts with metadata JSON or length prefix
  let trimmedBytes: Uint8Array = bytes; // Default to all bytes
  let hasLengthPrefix = false;
  let originalDataLength: number | undefined;
  
  // Check if there's metadata header (JSON at the start) - for files
  try {
    const textDecoder = new TextDecoder();
    const firstChars = textDecoder.decode(bytes.slice(0, Math.min(200, bytes.length)));
    
    if (firstChars.startsWith("{")) {
      // Try to parse as JSON metadata
      const jsonEnd = firstChars.indexOf("}");
      if (jsonEnd > 0) {
        const metadataStr = firstChars.slice(0, jsonEnd + 1);
        const metadata = JSON.parse(metadataStr);
        
        if (metadata.type === "file" && metadata.filename) {
          // It's a file with metadata
          const metadataBytes = new TextEncoder().encode(metadataStr);
          
          // Use originalSize from metadata if available (new format)
          if (metadata.originalSize !== undefined) {
            // New format: metadata has originalSize, so total unpadded size = metadataBytes.length + originalSize
            originalDataLength = metadataBytes.length + metadata.originalSize;
            console.log(`[FILEcoin] Using stored originalSize from metadata: ${metadata.originalSize} (total: ${originalDataLength})`);
            trimmedBytes = bytes.slice(0, originalDataLength);
          } else {
            // Old format: remove trailing zeros (fallback)
            let lastNonZero = bytes.length - 1;
            while (lastNonZero >= 0 && bytes[lastNonZero] === 0) {
              lastNonZero--;
            }
            trimmedBytes = bytes.slice(0, lastNonZero + 1);
            console.log(`[FILEcoin] Old format detected, removed padding by trailing zeros`);
          }
          
          // Extract file data (after metadata)
          const fileData = trimmedBytes.slice(metadataBytes.length);
          const base64Content = Buffer.from(fileData).toString("base64");
          
          return {
            pieceCid,
            size: fileData.length,
            format: "file",
            content: base64Content,
            filename: metadata.filename,
            mimeType: metadata.mimeType || "application/octet-stream",
            description: metadata.description,
            priceUSDC: metadata.priceUSDC,
            payAddress: metadata.payAddress,
          };
        }
      }
    }
  } catch (error) {
    // Not JSON metadata, continue with length prefix check
  }
  
  // Check if data starts with 4-byte length prefix (for text/binary without metadata)
  if (bytes.length >= 4) {
    try {
      const lengthBuffer = Buffer.from(bytes.slice(0, 4));
      const storedLength = lengthBuffer.readUInt32BE(0);
      
      // Sanity check: stored length should be reasonable (not larger than decrypted data)
      if (storedLength > 0 && storedLength <= bytes.length && storedLength < bytes.length - 100) {
        // Likely a length prefix - use it to extract exact data
        originalDataLength = 4 + storedLength; // 4 bytes prefix + data
        trimmedBytes = bytes.slice(0, originalDataLength);
        hasLengthPrefix = true;
        console.log(`[FILEcoin] Detected length prefix: ${storedLength} bytes (total with prefix: ${originalDataLength})`);
        
        // Extract data after length prefix
        const actualData = trimmedBytes.slice(4);
        
        // Try to decode as text
        try {
          const decodedText = new TextDecoder().decode(actualData);
          return {
            pieceCid,
            size: actualData.length,
            format: "text",
            content: decodedText,
          };
        } catch (error) {
          // If it's not text, return as base64
          const base64Content = Buffer.from(actualData).toString("base64");
          return {
            pieceCid,
            size: actualData.length,
            format: "binary",
            content: base64Content,
            message: "Content is binary, returned as base64. Decode to get original bytes.",
          };
        }
      }
    } catch (error) {
      // Not a valid length prefix, continue with fallback
    }
  }
  
  // Fallback: Remove trailing zeros (for old format or if length detection failed)
  if (!hasLengthPrefix) {
    let lastNonZero = bytes.length - 1;
    while (lastNonZero >= 0 && bytes[lastNonZero] === 0) {
      lastNonZero--;
    }
    if (lastNonZero < bytes.length - 1) {
      const paddingRemoved = bytes.length - (lastNonZero + 1);
      console.log(`[FILEcoin] Fallback: Removed ${paddingRemoved} bytes of padding (trailing zeros)`);
      trimmedBytes = bytes.slice(0, lastNonZero + 1);
    } else {
      trimmedBytes = bytes;
    }
  }
  
  // Try to decode as text (fallback)
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
  const synapse = await getSynapse();
  
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

/**
 * Downloads a file from a URL and returns the file data, filename, and mimeType
 */
export async function downloadFromUrl(url: string): Promise<{
  data: Uint8Array;
  filename?: string;
  mimeType?: string;
}> {
  console.log(`[URL_DOWNLOAD] Starting download from URL: ${url}`);
  
  try {
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status} ${response.statusText}`);
    }
    
    // Get content type from headers
    const contentType = response.headers.get("content-type") || undefined;
    console.log(`[URL_DOWNLOAD] Content-Type: ${contentType || "unknown"}`);
    
    // Try to extract filename from Content-Disposition header
    let filename: string | undefined;
    const contentDisposition = response.headers.get("content-disposition");
    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
      if (filenameMatch && filenameMatch[1]) {
        filename = filenameMatch[1].replace(/['"]/g, "");
        console.log(`[URL_DOWNLOAD] Filename from Content-Disposition: ${filename}`);
      }
    }
    
    // If no filename from header, try to extract from URL
    if (!filename) {
      try {
        const urlObj = new URL(url);
        const pathname = urlObj.pathname;
        const urlFilename = pathname.split("/").pop();
        if (urlFilename && urlFilename.includes(".")) {
          filename = urlFilename.split("?")[0]; // Remove query params
          console.log(`[URL_DOWNLOAD] Filename from URL: ${filename}`);
        }
      } catch (error) {
        // Invalid URL, skip filename extraction
      }
    }
    
    // Download the file as array buffer
    const arrayBuffer = await response.arrayBuffer();
    const data = new Uint8Array(arrayBuffer);
    
    console.log(`[URL_DOWNLOAD] Successfully downloaded ${data.length} bytes from URL`);
    
    return {
      data,
      filename,
      mimeType: contentType,
    };
  } catch (error: any) {
    console.error(`[URL_DOWNLOAD] Error downloading from URL:`, error);
    throw new Error(`Failed to download from URL: ${error.message}`);
  }
}

export async function uploadToFilecoin(
  data: string | Uint8Array,
  options: { 
    filename?: string; 
    mimeType?: string;
    description: string;
    priceUSDC: number | string;
    payAddress: string;
  }
): Promise<{
  pieceCid: string;
  size: number;
}> {
  const synapse = await getSynapse();
  
  let dataBytes: Uint8Array;
  
  // Store original unpadded length for later padding removal
  let originalUnpaddedLength: number;
  
  // If it's a file (has filename), add metadata header
  if (options.filename && data instanceof Uint8Array) {
    originalUnpaddedLength = data.length;
    const metadata: any = {
      type: "file",
      filename: options.filename,
      mimeType: options.mimeType || "application/octet-stream",
      description: options.description,
      priceUSDC: typeof options.priceUSDC === "string" 
        ? options.priceUSDC 
        : options.priceUSDC.toString(),
      payAddress: options.payAddress,
      originalSize: data.length, // Store original file size (before metadata)
      metadataSize: 0, // Will be set after encoding metadata
    };
    
    const metadataStr = JSON.stringify(metadata);
    const metadataBytes = new TextEncoder().encode(metadataStr);
    
    // Update metadataSize in the JSON (we need to re-encode, but simpler: store total data size)
    // Actually, we can calculate it: metadataSize = metadataBytes.length
    // But we need the full data size including metadata. Let's store the total unpadded size.
    const totalDataSize = metadataBytes.length + data.length;
    
    // Combine metadata + file data
    dataBytes = new Uint8Array(metadataBytes.length + data.length);
    dataBytes.set(metadataBytes, 0);
    dataBytes.set(data, metadataBytes.length);
    originalUnpaddedLength = totalDataSize; // Total size including metadata
  } else if (typeof data === "string") {
    // It's a text message - add 4-byte length prefix
    const textBytes = new TextEncoder().encode(data);
    originalUnpaddedLength = textBytes.length;
    
    // Prepend 4-byte length (big-endian) to the data
    const lengthBuffer = Buffer.allocUnsafe(4);
    lengthBuffer.writeUInt32BE(textBytes.length, 0);
    
    dataBytes = new Uint8Array(4 + textBytes.length);
    dataBytes.set(new Uint8Array(lengthBuffer), 0);
    dataBytes.set(textBytes, 4);
  } else {
    // It's binary data without filename - add 4-byte length prefix
    originalUnpaddedLength = data.length;
    
    // Prepend 4-byte length (big-endian) to the data
    const lengthBuffer = Buffer.allocUnsafe(4);
    lengthBuffer.writeUInt32BE(data.length, 0);
    
    dataBytes = new Uint8Array(4 + data.length);
    dataBytes.set(new Uint8Array(lengthBuffer), 0);
    dataBytes.set(data, 4);
  }
  
  // Filecoin requires minimum 127 bytes, pad PLAINTEXT data BEFORE encryption
  // We store the original length so we can remove padding after decryption
  const MIN_SIZE = 127;
  let paddedPlaintext = dataBytes;
  const wasPadded = dataBytes.length < MIN_SIZE;
  
  if (wasPadded) {
    // Pad plaintext with null bytes (0x00) BEFORE encryption
    paddedPlaintext = new Uint8Array(MIN_SIZE);
    paddedPlaintext.set(dataBytes, 0);
    // Rest is already zeros (default Uint8Array initialization)
    console.log(`[UPLOAD] Padded plaintext from ${dataBytes.length} to ${MIN_SIZE} bytes before encryption (original size: ${originalUnpaddedLength})`);
  } else {
    console.log(`[UPLOAD] No padding needed (size: ${dataBytes.length} bytes, original: ${originalUnpaddedLength})`);
  }
  
  // Encrypt the padded plaintext
  const encryptedData = encryptData(paddedPlaintext);
  console.log(`[UPLOAD] Encrypted data size: ${encryptedData.length} bytes (IV: ${IV_LENGTH}, AuthTag: ${AUTH_TAG_LENGTH}, Encrypted: ${encryptedData.length - IV_LENGTH - AUTH_TAG_LENGTH})`);
  
  const { pieceCid, size } = await synapse.storage.upload(encryptedData);
  return { pieceCid: pieceCid.toString(), size };
}

