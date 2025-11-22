/**
 * Input validation utilities
 */

/**
 * Validates PieceCID format
 */
export function validatePieceCid(pieceCid: string): void {
  if (!pieceCid || pieceCid.trim().length === 0) {
    throw new Error("pieceCid is required and cannot be empty");
  }
  
  // PieceCIDs typically start with 'b' (base32) or 'baga' (base36)
  // Basic validation - should be at least 10 characters
  if (pieceCid.length < 10) {
    throw new Error(`Invalid PieceCID format: too short. Expected a valid PieceCID (e.g., bafkzcibcaabai3vffxbbuatysolo6sfd23ffr3e5r5t4wbccfootkd2pi6uyupi)`);
  }
}

/**
 * Validates payment address format (EVM or Solana)
 * Rejects the zero address (0x0000...0000) as x402 struggles with it
 */
export function validatePayAddress(address: string): void {
  if (!address || address.trim().length === 0) {
    throw new Error("payAddress is required and cannot be empty");
  }
  
  // Check for zero address (burn address) - x402 struggles with this
  const zeroAddress = "0x0000000000000000000000000000000000000000";
  if (address.toLowerCase() === zeroAddress.toLowerCase()) {
    throw new Error(
      "payAddress cannot be the zero address (0x0000...0000). The zero address is not supported for x402 payments. Please provide a valid payment address."
    );
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

/**
 * Validates priceUSDC (must be positive number/string)
 */
export function validatePriceUSDC(priceUSDC: number | string): void {
  if (priceUSDC === undefined || priceUSDC === null) {
    throw new Error("priceUSDC is required");
  }
  
  const priceNum = typeof priceUSDC === "string" ? parseFloat(priceUSDC) : priceUSDC;
  
  if (isNaN(priceNum)) {
    throw new Error("priceUSDC must be a valid number");
  }
  
  if (priceNum < 0) {
    throw new Error("priceUSDC cannot be negative");
  }
  
  // Check if it's a whole number (USDC has 6 decimals, but we accept any positive number)
  if (priceNum !== Math.floor(priceNum)) {
    throw new Error("priceUSDC must be a whole number (microUSDC with 6 decimals)");
  }
}

/**
 * Validates URL format
 */
export function validateUrl(url: string): void {
  if (!url || url.trim().length === 0) {
    throw new Error("url is required and cannot be empty");
  }
  
  try {
    const urlObj = new URL(url);
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      throw new Error("URL must use http or https protocol");
    }
  } catch (error) {
    throw new Error(`Invalid URL format: ${url}`);
  }
}

/**
 * Validates that a string is not empty after trimming
 */
export function validateNonEmptyString(value: string, fieldName: string): void {
  if (!value || value.trim().length === 0) {
    throw new Error(`${fieldName} is required and cannot be empty`);
  }
}

/**
 * Validates base64 string format
 */
export function validateBase64(base64String: string): void {
  if (!base64String || base64String.trim().length === 0) {
    throw new Error("Base64 file data cannot be empty");
  }
  
  // Basic base64 validation: should only contain base64 characters and padding
  const base64Pattern = /^[A-Za-z0-9+/]*={0,2}$/;
  if (!base64Pattern.test(base64String)) {
    throw new Error("Invalid base64 format. File data must be valid base64-encoded");
  }
}

