import express from "express";
import { downloadFromFilecoin, uploadToFilecoin } from "./services/filecoin.js";

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
    const { message, file, filename, mimeType } = req.body;

    if (!message && !file) {
      return res.status(400).json({
        error: "Missing message or file in request body",
        usage: "POST /upload with JSON body: { \"message\": \"text\" } OR { \"file\": \"base64\", \"filename\": \"file.pdf\", \"mimeType\": \"application/pdf\" }",
        examples: [
          { message: "Hello, Filecoin!" },
          { file: "JVBERi0xLjQK...", filename: "document.pdf", mimeType: "application/pdf" },
        ],
      });
    }

    let pieceCid: string;
    let size: number;
    let uploadType: string;

    if (file) {
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
      }));
      
      uploadType = "file";
      console.log(`[UPLOAD] Successfully uploaded file to Filecoin - PieceCID: ${pieceCid}, Size: ${size} bytes`);
    } else {
      // Text message upload
      const messageSize = new TextEncoder().encode(message).length;
      console.log(`[UPLOAD] Starting upload for message (${messageSize} bytes)`);
      
      ({ pieceCid, size } = await uploadToFilecoin(message));
      
      uploadType = "message";
      console.log(`[UPLOAD] Successfully uploaded message to Filecoin - PieceCID: ${pieceCid}, Size: ${size} bytes`);
    }

    return res.json({
      success: true,
      pieceCid: pieceCid,
      size: size,
      type: uploadType,
      message: uploadType === "file" 
        ? `File "${filename}" stored successfully on Filecoin`
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

    return res.status(500).json({
      error: "Upload failed",
      message: error.message || "Unknown error occurred",
    });
  }
});

export default router;

