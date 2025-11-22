import express from "express";
import { downloadFromFilecoin, uploadToFilecoin, downloadFromUrl } from "./services/filecoin.js";
import { registerUploadOnContract } from "./services/contract.js";

const router = express.Router();

// Free endpoints
router.get("/hello", (req, res) => {
  res.json({
    hello: "world",
  });
});

// Filecoin endpoints
router.get("/download", async (req, res) => {
  try {
    const pieceCid = req.query.pieceCid as string;

    if (!pieceCid) {
      return res.status(400).json({
        error: "Missing pieceCid parameter",
        usage: "GET /download?pieceCid=<PieceCID>",
        example: "GET /download?pieceCid=baga6ea4seaq...",
      });
    }

    console.log(`[DOWNLOAD] Starting download for PieceCID: ${pieceCid}`);
    const result = await downloadFromFilecoin(pieceCid);
    console.log(`[DOWNLOAD] Successfully downloaded ${result.size} bytes (format: ${result.format})`);
    return res.json(result);
  } catch (error: any) {
    console.error("Download error:", error);
    return res.status(500).json({
      error: "Download failed",
      message: error.message || "Unknown error occurred",
    });
  }
});

// Test endpoint without payment middleware
router.get("/download_test", async (req, res) => {
  try {
    const pieceCid = req.query.pieceCid as string;

    if (!pieceCid) {
      return res.status(400).json({
        error: "Missing pieceCid parameter",
        usage: "GET /download_test?pieceCid=<PieceCID>",
        example: "GET /download_test?pieceCid=baga6ea4seaq...",
      });
    }

    console.log(`[DOWNLOAD_TEST] Starting download for PieceCID: ${pieceCid}`);
    const result = await downloadFromFilecoin(pieceCid);
    console.log(`[DOWNLOAD_TEST] Successfully downloaded ${result.size} bytes (format: ${result.format})`);
    return res.json(result);
  } catch (error: any) {
    console.error("Download test error:", error);
    return res.status(500).json({
      error: "Download failed",
      message: error.message || "Unknown error occurred",
    });
  }
});

router.post("/upload", async (req, res) => {
  try {
    const { message, file, filename, mimeType, url, description, priceUSDC, payAddress } = req.body;

    // Validate required payment metadata fields
    if (!description) {
      return res.status(400).json({
        error: "Missing required field: description",
        message: "description is required to describe what the file is",
      });
    }
    if (priceUSDC === undefined || priceUSDC === null) {
      return res.status(400).json({
        error: "Missing required field: priceUSDC",
        message: "priceUSDC is required (price in USDC with 6 decimals, e.g., 1000000 for 1 USDC)",
      });
    }
    if (!payAddress) {
      return res.status(400).json({
        error: "Missing required field: payAddress",
        message: "payAddress is required (address to receive payments, 0x... for EVM or Solana address)",
      });
    }

    if (!message && !file && !url) {
      return res.status(400).json({
        error: "Missing message, file, or url in request body",
        usage: "POST /upload with JSON body: { \"message\": \"text\" } OR { \"file\": \"base64\", \"filename\": \"file.pdf\", \"mimeType\": \"application/pdf\" } OR { \"url\": \"https://example.com/file.pdf\" }",
        requiredFields: {
          description: "Description of what the file is (required)",
          priceUSDC: "Price in USDC (6 decimals, e.g., 1000000 for 1 USDC) (required)",
          payAddress: "Address to receive payments (0x... or Solana address) (required)",
        },
        examples: [
          { message: "Hello, Filecoin!", description: "A greeting message", priceUSDC: "1000000", payAddress: "0x1234..." },
          { file: "JVBERi0xLjQK...", filename: "document.pdf", mimeType: "application/pdf", description: "Important document", priceUSDC: "2000000", payAddress: "0x1234..." },
          { url: "https://example.com/document.pdf", description: "Research paper", priceUSDC: "5000000", payAddress: "0x1234..." },
        ],
      });
    }

    let pieceCid: string;
    let size: number;
    let uploadType: string;
    let finalFilename: string | undefined;

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

    console.log(`[UPLOAD] Description: ${description}`);
    console.log(`[UPLOAD] Price: ${priceUSDC} USDC (6 decimals)`);
    console.log(`[UPLOAD] Pay address: ${payAddress}`);

    if (url) {
      // URL upload - download file from external URL, then upload to Filecoin
      console.log(`[UPLOAD] Starting URL upload process for: ${url}`);
      console.log(`[UPLOAD] Step 1: Downloading file from external URL...`);
      
      const { data, filename: urlFilename, mimeType: urlMimeType } = await downloadFromUrl(url);
      
      finalFilename = urlFilename || filename || `downloaded_file_${Date.now()}`;
      const finalMimeType = urlMimeType || mimeType || "application/octet-stream";
      
      console.log(`[UPLOAD] Step 1 complete: Downloaded ${data.length} bytes from external URL (filename: ${finalFilename}, type: ${finalMimeType})`);
      console.log(`[UPLOAD] Step 2: Encrypting and uploading to Filecoin...`);
      
      ({ pieceCid, size } = await uploadToFilecoin(data, {
        filename: finalFilename,
        mimeType: finalMimeType,
        ...uploadOptions,
      }));
      
      uploadType = "url";
      console.log(`[UPLOAD] Step 2 complete: Successfully uploaded to Filecoin - PieceCID: ${pieceCid}, Size: ${size} bytes`);
    } else if (file) {
      // File upload (base64 encoded)
      if (!filename) {
        return res.status(400).json({
          error: "filename is required when uploading a file",
        });
      }

      const fileBytes = Buffer.from(file, "base64");
      const fileSize = fileBytes.length;
      console.log(`[UPLOAD] Starting upload for file: ${filename} (${fileSize} bytes, ${mimeType || "unknown type"})`);
      
      ({ pieceCid, size } = await uploadToFilecoin(fileBytes, {
        filename,
        mimeType: mimeType || "application/octet-stream",
        ...uploadOptions,
      }));
      
      uploadType = "file";
      finalFilename = filename;
      console.log(`[UPLOAD] Successfully uploaded file to Filecoin - PieceCID: ${pieceCid}, Size: ${size} bytes`);
    } else {
      // Text message upload
      const messageSize = new TextEncoder().encode(message).length;
      console.log(`[UPLOAD] Starting upload for message (${messageSize} bytes)`);
      
      ({ pieceCid, size } = await uploadToFilecoin(message, uploadOptions));
      
      uploadType = "message";
      console.log(`[UPLOAD] Successfully uploaded message to Filecoin - PieceCID: ${pieceCid}, Size: ${size} bytes`);
    }

    // Register upload on smart contract
    console.log(`[UPLOAD] Registering upload on BAHack smart contract...`);
    let contractTxHash: string | undefined;
    let contractBlockNumber: number | undefined;
    try {
      const contractResult = await registerUploadOnContract(
        pieceCid,
        description,
        priceUSDC,
        payAddress,
      );
      contractTxHash = contractResult.txHash;
      contractBlockNumber = contractResult.blockNumber;
      console.log(`[UPLOAD] Successfully registered on contract: ${contractTxHash}`);
    } catch (error: any) {
      console.error(`[UPLOAD] Failed to register on contract:`, error);
      // Don't fail the entire upload if contract registration fails
      // The file is already on Filecoin, so we log the error but continue
    }

    return res.json({
      success: true,
      pieceCid: pieceCid,
      size: size,
      type: uploadType,
      filename: finalFilename,
      description: description,
      priceUSDC: priceUSDC,
      payAddress: payAddress,
      contractTxHash: contractTxHash,
      contractBlockNumber: contractBlockNumber,
      message: uploadType === "url"
        ? `File from URL "${url}" stored successfully on Filecoin as "${finalFilename}"`
        : uploadType === "file"
        ? `File "${finalFilename}" stored successfully on Filecoin`
        : "Message stored successfully on Filecoin",
    });
  } catch (error: any) {
    console.error("Upload error:", error);
    
    if (error.message?.includes("PRIVATE_KEY")) {
      return res.status(500).json({
        error: "PRIVATE_KEY not configured",
        message: "Uploads require a valid PRIVATE_KEY. Please set it in your environment variables.",
      });
    }

    if (error.message?.includes("Failed to download from URL")) {
      return res.status(500).json({
        error: "URL download failed",
        message: error.message || "Could not download file from the provided URL",
      });
    }

    return res.status(500).json({
      error: "Upload failed",
      message: error.message || "Unknown error occurred",
    });
  }
});

export default router;

