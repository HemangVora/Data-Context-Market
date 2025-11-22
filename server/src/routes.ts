import express from "express";
import { downloadFromFilecoin, uploadToFilecoin, downloadFromUrl } from "./services/filecoin.js";
import { registerUploadOnContract, CONTRACT_ADDRESS } from "./services/contract.js";
import { getAllDatasetEvents } from "./services/clickhouse.js";
import { compareTwoStrings } from "string-similarity";
import { RequestWithContractData, DownloadResult, UploadRequestBody, ErrorResponse } from "./types.js";
import {
  validatePieceCid,
  validatePayAddress,
  validatePriceUSDC,
  validateUrl,
  validateNonEmptyString,
  validateBase64,
} from "./utils/validation.js";
import { handleRouteError, createErrorResponse } from "./utils/errors.js";

const router = express.Router();

// Free endpoints
router.get("/hello", (req, res) => {
  res.json({
    hello: "world",
  });
});

/**
 * Helper function to add contract metadata to download result
 */
function addContractMetadataToResult(
  result: DownloadResult,
  contractData: RequestWithContractData["contractData"]
): void {
  if (contractData) {
    result.name = contractData.name;
    result.filetype = contractData.filetype;
    // Set type: "message" if it's a message, otherwise use filetype
    result.type =
      result.format === "text" && !result.filename
        ? "message"
        : contractData.filetype || result.mimeType || "application/octet-stream";
  } else {
    // Fallback: use filetype from result if available
    result.type =
      result.format === "text" && !result.filename
        ? "message"
        : result.mimeType || "application/octet-stream";
  }
}

// Filecoin endpoints
// Download endpoint - supports both /download?pieceCid=... and /download/:pieceCid
router.get("/download", async (req: RequestWithContractData, res) => {
  // Check if response was already sent by middleware (e.g., 402 Payment Required)
  if (res.headersSent) {
    console.log(`[ROUTE] Response already sent by middleware, skipping route handler`);
    return;
  }

  console.log(`[ROUTE] /download route handler called`);
  console.log(`[ROUTE] Request path: ${req.path}, query:`, req.query, `params:`, req.params);

  try {
    // Support both query parameter and path parameter
    const pieceCid = (req.params.pieceCid as string) || (req.query.pieceCid as string);
    console.log(`[ROUTE] Extracted pieceCid: ${pieceCid}`);

    if (!pieceCid) {
      console.log(`[ROUTE] ✗ Missing pieceCid parameter`);
      return res.status(400).json(
        createErrorResponse("Missing pieceCid parameter", "pieceCid is required", {
          usage: ["GET /download?pieceCid=<PieceCID>", "GET /download/<PieceCID>"],
          example: ["GET /download?pieceCid=baga6ea4seaq...", "GET /download/baga6ea4seaq..."],
        })
      );
    }

    // Validate PieceCID format
    validatePieceCid(pieceCid);

    console.log(`[ROUTE] Starting download for PieceCID: ${pieceCid}`);
    const result = await downloadFromFilecoin(pieceCid);

    // Add contract metadata (name and filetype) if available from middleware
    addContractMetadataToResult(result, req.contractData);

    console.log(`[ROUTE] ✓ Successfully downloaded ${result.size} bytes (format: ${result.format}, type: ${result.type})`);
    return res.json(result);
  } catch (error: unknown) {
    console.error(`[ROUTE] ✗ Download error:`, error);
    // Only send response if headers haven't been sent yet
    if (!res.headersSent) {
      const { status, response } = handleRouteError(error, "Download failed");
      return res.status(status).json(response);
    }
  }
});

// Also support path parameter format: /download/:pieceCid
router.get("/download/:pieceCid", async (req: RequestWithContractData, res) => {
  // Check if response was already sent by middleware (e.g., 402 Payment Required)
  if (res.headersSent) {
    console.log(`[ROUTE] Response already sent by middleware, skipping route handler`);
    return;
  }

  console.log(`[ROUTE] /download/:pieceCid route handler called`);
  console.log(`[ROUTE] Request path: ${req.path}, params:`, req.params);

  try {
    const pieceCid = req.params.pieceCid as string;
    console.log(`[ROUTE] Extracted pieceCid from params: ${pieceCid}`);

    if (!pieceCid) {
      console.log(`[ROUTE] ✗ Missing pieceCid parameter`);
      return res.status(400).json(
        createErrorResponse("Missing pieceCid parameter", "pieceCid is required", {
          usage: "GET /download/<PieceCID>",
          example: "GET /download/baga6ea4seaq...",
        })
      );
    }

    // Validate PieceCID format
    validatePieceCid(pieceCid);

    console.log(`[ROUTE] Starting download for PieceCID: ${pieceCid}`);
    const result = await downloadFromFilecoin(pieceCid);

    // Add contract metadata (name and filetype) if available from middleware
    addContractMetadataToResult(result, req.contractData);

    console.log(`[ROUTE] ✓ Successfully downloaded ${result.size} bytes (format: ${result.format}, type: ${result.type})`);
    return res.json(result);
  } catch (error: unknown) {
    console.error(`[ROUTE] ✗ Download error:`, error);
    // Only send response if headers haven't been sent yet
    if (!res.headersSent) {
      const { status, response } = handleRouteError(error, "Download failed");
      return res.status(status).json(response);
    }
  }
});

// Test endpoint without payment middleware
router.get("/download_test", async (req, res) => {
  try {
    const pieceCid = req.query.pieceCid as string;

    if (!pieceCid) {
      return res.status(400).json(
        createErrorResponse("Missing pieceCid parameter", "pieceCid is required", {
        usage: "GET /download_test?pieceCid=<PieceCID>",
        example: "GET /download_test?pieceCid=baga6ea4seaq...",
        })
      );
    }

    validatePieceCid(pieceCid);

    console.log(`[DOWNLOAD_TEST] Starting download for PieceCID: ${pieceCid}`);
    const result = await downloadFromFilecoin(pieceCid);
    console.log(`[DOWNLOAD_TEST] Successfully downloaded ${result.size} bytes (format: ${result.format})`);
    return res.json(result);
  } catch (error: unknown) {
    console.error("Download test error:", error);
    const { status, response } = handleRouteError(error, "Download failed");
    return res.status(status).json(response);
  }
});

/**
 * Deduces filetype from mimeType or filename extension
 */
function deduceFiletype(mimeType?: string, filename?: string): string {
  // If mimeType is provided, use it
  if (mimeType) {
    return mimeType;
  }
  
  // Otherwise, try to deduce from filename extension
  if (filename) {
    const ext = filename.split('.').pop()?.toLowerCase();
    const mimeMap: Record<string, string> = {
      'pdf': 'application/pdf',
      'txt': 'text/plain',
      'json': 'application/json',
      'png': 'image/png',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'gif': 'image/gif',
      'svg': 'image/svg+xml',
      'mp4': 'video/mp4',
      'mp3': 'audio/mpeg',
      'zip': 'application/zip',
      'html': 'text/html',
      'css': 'text/css',
      'js': 'application/javascript',
      'xml': 'application/xml',
    };
    
    if (ext && mimeMap[ext]) {
      return mimeMap[ext];
    }
  }
  
  // Default fallback
  return 'application/octet-stream';
}

router.post("/upload", async (req, res) => {
  try {
    const body = req.body as UploadRequestBody;

    // Validate required fields
    try {
      validateNonEmptyString(body.name, "name");
      validateNonEmptyString(body.description, "description");
      validatePriceUSDC(body.priceUSDC);
      validatePayAddress(body.payAddress);
    } catch (validationError: unknown) {
      const errorMessage = validationError instanceof Error ? validationError.message : "Validation error";
      return res.status(400).json(createErrorResponse("Validation error", errorMessage));
    }

    // Validate that at least one content source is provided
    if (!body.message && !body.file && !body.url) {
      return res.status(400).json(
        createErrorResponse("Missing content", "Either message, file, or url must be provided", {
          usage: "POST /upload with JSON body: { \"message\": \"text\" } OR { \"file\": \"base64\", \"filename\": \"file.pdf\", \"mimeType\": \"application/pdf\" } OR { \"url\": \"https://example.com/file.pdf\" }",
          requiredFields: {
            name: "Name of the file/data (required)",
            description: "Description of what the file is (required)",
            priceUSDC: "Price in USDC (6 decimals, e.g., 1000000 for 1 USDC) (required)",
            payAddress: "Address to receive payments (0x... or Solana address) (required)",
          },
        examples: [
            { message: "Hello, Filecoin!", name: "greeting", description: "A greeting message", priceUSDC: "1000000", payAddress: "0x1234..." },
            { file: "JVBERi0xLjQK...", filename: "document.pdf", mimeType: "application/pdf", name: "document", description: "Important document", priceUSDC: "2000000", payAddress: "0x1234..." },
            { url: "https://example.com/document.pdf", name: "research-paper", description: "Research paper", priceUSDC: "5000000", payAddress: "0x1234..." },
          ],
        })
      );
    }

    // Validate URL if provided
    if (body.url) {
      try {
        validateUrl(body.url);
      } catch (validationError: unknown) {
        const errorMessage = validationError instanceof Error ? validationError.message : "Invalid URL";
        return res.status(400).json(createErrorResponse("Validation error", errorMessage));
      }
    }

    // Validate base64 file if provided
    if (body.file) {
      if (!body.filename) {
        return res.status(400).json(createErrorResponse("Missing filename", "filename is required when uploading a file"));
      }
      try {
        validateBase64(body.file);
      } catch (validationError: unknown) {
        const errorMessage = validationError instanceof Error ? validationError.message : "Invalid base64";
        return res.status(400).json(createErrorResponse("Validation error", errorMessage));
      }
    }

    const { message, file, filename, mimeType, url, description, priceUSDC, payAddress, name } = body;

    let pieceCid: string;
    let size: number;
    let uploadType: string;
    let finalFilename: string | undefined;
    let finalFiletype: string = "";

    // Use provided name
    const finalName = name;

    // Prepare upload options with required payment metadata
    const uploadOptions: {
      filename?: string;
      mimeType?: string;
      description: string;
      priceUSDC: number | string;
      payAddress: string;
    } = {
      description,
      priceUSDC,
      payAddress,
    };

    console.log(`[UPLOAD] Name: ${finalName}`);
    console.log(`[UPLOAD] Description: ${description}`);
    console.log(`[UPLOAD] Price: ${priceUSDC} USDC (6 decimals)`);
    console.log(`[UPLOAD] Pay address: ${payAddress}`);

    if (url) {
      // URL upload - download file from external URL, then upload to Filecoin
      console.log(`[UPLOAD] Starting URL upload process for: ${url}`);
      console.log(`[UPLOAD] Step 1: Downloading file from external URL...`);
      
      const { data, filename: urlFilename, mimeType: urlMimeType } = await downloadFromUrl(url);
      
      finalFilename = urlFilename || filename || finalName;
      // Deduce filetype from mimeType or filename
      finalFiletype = deduceFiletype(urlMimeType || mimeType, finalFilename);
      
      console.log(`[UPLOAD] Step 1 complete: Downloaded ${data.length} bytes from external URL (filename: ${finalFilename}, type: ${finalFiletype})`);
      console.log(`[UPLOAD] Step 2: Encrypting and uploading to Filecoin...`);
      
      ({ pieceCid, size } = await uploadToFilecoin(data, {
        filename: finalFilename,
        mimeType: finalFiletype,
        ...uploadOptions,
      }));
      
      uploadType = "url";
      console.log(`[UPLOAD] Step 2 complete: Successfully uploaded to Filecoin - PieceCID: ${pieceCid}, Size: ${size} bytes`);
    } else if (file) {
      // File upload (base64 encoded) - filename already validated above
      const fileBytes = Buffer.from(file, "base64");
      const fileSize = fileBytes.length;
      console.log(`[UPLOAD] Starting upload for file: ${filename} (${fileSize} bytes, ${mimeType || "unknown type"})`);
      
      // Deduce filetype from mimeType or filename
      finalFiletype = deduceFiletype(mimeType, filename);
      ({ pieceCid, size } = await uploadToFilecoin(fileBytes, {
        filename,
        mimeType: finalFiletype,
        ...uploadOptions,
      }));
      
      uploadType = "file";
      finalFilename = filename;
      console.log(`[UPLOAD] Successfully uploaded file to Filecoin - PieceCID: ${pieceCid}, Size: ${size} bytes`);
    } else {
      // Text message upload
      if (!message) {
        return res.status(400).json(createErrorResponse("Missing message", "message is required for text upload"));
      }
      const messageSize = new TextEncoder().encode(message).length;
      console.log(`[UPLOAD] Starting upload for message (${messageSize} bytes)`);
      
      // For messages, filetype is always text/plain
      finalFiletype = "text/plain";
      ({ pieceCid, size } = await uploadToFilecoin(message, uploadOptions));
      
      uploadType = "message";
      console.log(`[UPLOAD] Successfully uploaded message to Filecoin - PieceCID: ${pieceCid}, Size: ${size} bytes`);
    }

    // Register upload on smart contract
    console.log(`[UPLOAD] Registering upload on DataBoxRegistry smart contract...`);
    let dataRegistryTxHash: string | undefined;
    let dataRegistryBlockNumber: number | undefined;
    try {
      const contractResult = await registerUploadOnContract(
        pieceCid,
        description,
        priceUSDC,
        payAddress,
        finalName,
        finalFiletype,
      );
      dataRegistryTxHash = contractResult.txHash;
      dataRegistryBlockNumber = contractResult.blockNumber;
      console.log(`[UPLOAD] Successfully registered on contract ${CONTRACT_ADDRESS}`);
      console.log(`[UPLOAD] Transaction hash: ${dataRegistryTxHash}`);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error(`[UPLOAD] Failed to register on contract:`, errorMessage);
      // Don't fail the entire upload if contract registration fails
      // The file is already on Filecoin, so we log the error but continue
    }

    // Set type: "message" for messages, otherwise use filetype
    const responseType = uploadType === "message" ? "message" : finalFiletype;
    
    console.log(`[UPLOAD] ========================================`);
    console.log(`[UPLOAD] ✓ Upload completed successfully!`);
    console.log(`[UPLOAD]   - PieceCID: ${pieceCid}`);
    console.log(`[UPLOAD]   - Name: ${finalName}`);
    console.log(`[UPLOAD]   - Size: ${size} bytes`);
    if (dataRegistryTxHash) {
      console.log(`[UPLOAD]   - Contract: ${CONTRACT_ADDRESS}`);
      console.log(`[UPLOAD]   - Transaction: ${dataRegistryTxHash}`);
    }
    console.log(`[UPLOAD] ========================================`);
    
    return res.json({
      success: true,
      pieceCid: pieceCid,
      size: size,
      type: responseType,
      name: finalName,
      filetype: finalFiletype,
      filename: finalFilename,
      description: description,
      priceUSDC: priceUSDC,
      payAddress: payAddress,
      dataRegistryTxHash: dataRegistryTxHash,
      dataRegistryTxUrl: dataRegistryTxHash ? `https://sepolia.etherscan.io/tx/${dataRegistryTxHash}` : undefined,
      dataRegistryBlockNumber: dataRegistryBlockNumber,
      message: uploadType === "url"
        ? `File from URL "${url}" stored successfully on Filecoin as "${finalFilename}"`
        : uploadType === "file"
        ? `File "${finalFilename}" stored successfully on Filecoin`
        : "Message stored successfully on Filecoin",
    });
  } catch (error: unknown) {
    console.error("Upload error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    if (errorMessage.includes("PRIVATE_KEY")) {
      return res.status(500).json(
        createErrorResponse("PRIVATE_KEY not configured", "Uploads require a valid PRIVATE_KEY. Please set it in your environment variables.")
      );
    }

    if (errorMessage.includes("Failed to download from URL")) {
      return res.status(500).json(
        createErrorResponse("URL download failed", errorMessage || "Could not download file from the provided URL")
      );
    }

    const { status, response } = handleRouteError(error, "Upload failed");
    return res.status(status).json(response);
  }
});

// Discover all endpoint - returns all available datasets
router.get("/discover_all", async (req, res) => {
  try {
    console.log(`[DISCOVER_ALL] Fetching all datasets from ClickHouse...`);
    
    // Fetch all dataset events from ClickHouse
    const allEvents = await getAllDatasetEvents();
    
    const results = allEvents.map((event) => ({
      pieceCid: event.piece_cid,
      name: event.name,
      description: event.description,
      price: event.price_usdc,
      filetype: event.filetype,
      payAddress: event.pay_address,
    }));
    
    console.log(`[DISCOVER_ALL] ✓ Returning ${results.length} results`);
    
    return res.json({
      success: true,
      count: results.length,
      results: results,
    });
  } catch (error: unknown) {
    console.error(`[DISCOVER_ALL] ✗ Error in discover_all endpoint:`, error);
    const { status, response } = handleRouteError(error, "Discover all failed");
    return res.status(status).json(response);
  }
});

// Discover query endpoint - requires a query and returns a single matching dataset
router.get("/discover_query", async (req, res) => {
  try {
    const query = req.query.q as string | undefined;
    
    if (!query || query.trim().length === 0) {
      return res.status(400).json(
        createErrorResponse("Missing required parameter: q", "Query parameter 'q' is required", {
          usage: "GET /discover_query?q=search+term",
          example: "GET /discover_query?q=financial+data",
        })
      );
    }
    
    console.log(`[DISCOVER_QUERY] Query request received: "${query}"`);
    
    // Fetch all dataset events from ClickHouse
    const allEvents = await getAllDatasetEvents();
    
    // Improved search: use string similarity for better matching
    const queryLower = query.toLowerCase().trim();
    const queryWords = queryLower.split(/\s+/).filter(w => w.length > 0);
    
    // Score each event based on relevance using string similarity
    const scoredEvents = allEvents.map((event) => {
      let score = 0;
      const nameLower = event.name.toLowerCase();
      const descLower = event.description.toLowerCase();
      
      // Calculate string similarity scores (0-1 range)
      const nameSimilarity = compareTwoStrings(queryLower, nameLower);
      const descSimilarity = compareTwoStrings(queryLower, descLower);
      
      // Use similarity scores as base (multiply by 100 for easier scoring)
      // Name matches are weighted more heavily
      score += nameSimilarity * 100;
      score += descSimilarity * 50;
      
      // Exact match in name (highest priority)
      if (nameLower === queryLower) {
        score += 50; // Bonus for exact match
      }
      // Exact match in description
      else if (descLower === queryLower) {
        score += 30; // Bonus for exact match
      }
      // Name starts with query
      else if (nameLower.startsWith(queryLower)) {
        score += 30;
      }
      // Description starts with query
      else if (descLower.startsWith(queryLower)) {
        score += 15;
      }
      // Query is contained in name
      else if (nameLower.includes(queryLower)) {
        score += 20;
      }
      // Query is contained in description
      else if (descLower.includes(queryLower)) {
        score += 10;
      }
      
      // Word-by-word matching with similarity (for multi-word queries)
      if (queryWords.length > 1) {
        let nameWordMatches = 0;
        let descWordMatches = 0;
        let nameWordSimilarity = 0;
        let descWordSimilarity = 0;
        
        queryWords.forEach((word) => {
          if (nameLower.includes(word)) {
            nameWordMatches++;
            score += 15; // Bonus for each word match in name
          } else {
            // Check similarity even if not exact match
            const wordSim = compareTwoStrings(word, nameLower);
            nameWordSimilarity += wordSim;
          }
          
          if (descLower.includes(word)) {
            descWordMatches++;
            score += 8; // Bonus for each word match in description
          } else {
            // Check similarity even if not exact match
            const wordSim = compareTwoStrings(word, descLower);
            descWordSimilarity += wordSim;
          }
        });
        
        // Add average word similarity scores
        score += (nameWordSimilarity / queryWords.length) * 20;
        score += (descWordSimilarity / queryWords.length) * 10;
        
        // Bonus if all words match in name
        if (nameWordMatches === queryWords.length) {
          score += 25;
        }
        // Bonus if all words match in description
        if (descWordMatches === queryWords.length) {
          score += 15;
        }
      }
      
      return { event, score };
    }).filter(({ score }) => score > 10); // Only keep events with meaningful similarity (threshold: 10)
    
    if (scoredEvents.length === 0) {
      console.log(`[DISCOVER_QUERY] ✗ No matching dataset found for query: "${query}"`);
      return res.status(404).json(
        createErrorResponse("No matching dataset found", `No dataset found matching the query "${query}"`, {
          query: query,
        })
      );
    }
    
    // Sort by score (highest first) and get the best match
    scoredEvents.sort((a, b) => b.score - a.score);
    const bestMatch = scoredEvents[0];
    
    console.log(`[DISCOVER_QUERY] Found ${scoredEvents.length} matches, best score: ${bestMatch.score}`);
    
    const result = {
      pieceCid: bestMatch.event.piece_cid,
      name: bestMatch.event.name,
      description: bestMatch.event.description,
      price: bestMatch.event.price_usdc,
      filetype: bestMatch.event.filetype,
      payAddress: bestMatch.event.pay_address,
    };
    
    console.log(`[DISCOVER_QUERY] ✓ Found matching dataset: ${result.name} (${result.pieceCid})`);
    
    return res.json({
      success: true,
      query: query,
      result: result,
    });
  } catch (error: unknown) {
    console.error(`[DISCOVER_QUERY] ✗ Error in discover_query endpoint:`, error);
    const { status, response } = handleRouteError(error, "Discover query failed");
    return res.status(status).json(response);
  }
});

export default router;

