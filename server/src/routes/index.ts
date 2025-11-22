import express from "express";
import { downloadFromFilecoin, uploadToFilecoin } from "../services/filecoin.js";

const router = express.Router();

// Free endpoints
router.get("/hello", (req, res) => {
  res.json({
    hello: "world",
  });
});

// Paid endpoints (protected by payment middleware)
router.get("/weather", (req, res) => {
  res.send({
    report: {
      weather: "rainy",
      temperature: 420,
    },
  });
});

router.get("/premium/content", (req, res) => {
  res.send({
    content: "This is premium content",
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

    const result = await downloadFromFilecoin(pieceCid);
    return res.json(result);
  } catch (error: any) {
    console.error("Download error:", error);
    return res.status(500).json({
      error: "Download failed",
      message: error.message || "Unknown error occurred",
    });
  }
});

router.post("/upload", async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({
        error: "Missing message in request body",
        usage: "POST /upload with JSON body: { \"message\": \"your message here\" }",
        example: { message: "Hello, Filecoin!" },
      });
    }

    const { pieceCid, size } = await uploadToFilecoin(message);

    return res.json({
      success: true,
      pieceCid: pieceCid,
      size: size,
      message: "Message stored successfully on Filecoin",
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

