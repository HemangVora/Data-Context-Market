import express, { Request, Response, NextFunction } from "express";
import { paymentMiddleware, Resource, type SolanaAddress } from "x402-express";
import { facilitatorUrl, payTo } from "./config.js";
import { getFileSizeFromFilecoin } from "./services/filecoin.js";

// Price per byte in dollars
const PRICE_PER_BYTE = 0.0001;

/**
 * Calculates price based on file size
 */
function calculatePrice(sizeInBytes: number): string {
  const totalPrice = sizeInBytes * PRICE_PER_BYTE;
  // Format to 6 decimal places to handle very small amounts
  return `$${totalPrice.toFixed(6)}`;
}

/**
 * Dynamic pricing middleware for /download endpoint
 * Fetches file size first, then applies x402 payment middleware with calculated price
 */
async function dynamicPricingMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  // Only apply to /download endpoint
  if (req.path !== "/download" || req.method !== "GET") {
    return next();
  }

  const pieceCid = req.query.pieceCid as string;
  if (!pieceCid) {
    // Let the route handler deal with missing pieceCid
    return next();
  }

  console.log(`[DYNAMIC_PRICING] ========================================`);
  console.log(`[DYNAMIC_PRICING] Starting pricing calculation for PieceCID: ${pieceCid}`);
  console.log(`[DYNAMIC_PRICING] Request URL: ${req.protocol}://${req.headers.host}${req.path}${req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : ''}`);

  try {
    // Fetch file size (this is free - just metadata)
    console.log(`[DYNAMIC_PRICING] Fetching file size from Filecoin...`);
    const fileSize = await getFileSizeFromFilecoin(pieceCid);
    console.log(`[DYNAMIC_PRICING] ✓ File size fetched: ${fileSize} bytes`);
    
    // Calculate dynamic price
    const dynamicPrice = calculatePrice(fileSize);
    console.log(`[DYNAMIC_PRICING] ✓ Calculated price: ${dynamicPrice} (${fileSize} bytes × $${PRICE_PER_BYTE}/byte)`);
    
    // Store in request for potential use
    (req as any).dynamicPrice = dynamicPrice;
    (req as any).fileSize = fileSize;

    // Create x402 middleware dynamically with calculated price
    console.log(`[DYNAMIC_PRICING] Creating x402 payment middleware...`);
    console.log(`[DYNAMIC_PRICING]   - Price: ${dynamicPrice}`);
    console.log(`[DYNAMIC_PRICING]   - Network: base-sepolia`);
    console.log(`[DYNAMIC_PRICING]   - Pay to: ${payTo}`);
    console.log(`[DYNAMIC_PRICING]   - Facilitator: ${facilitatorUrl}`);
    
    const dynamicPaymentMiddleware = paymentMiddleware(
      payTo,
      {
        "GET /download": {
          price: dynamicPrice,
          network: "base-sepolia",
        },
      },
      {
        url: facilitatorUrl,
      },
    );

    // Execute the dynamically created middleware
    console.log(`[DYNAMIC_PRICING] Executing x402 payment middleware (checking for X-PAYMENT header)...`);
    const hasPaymentHeader = req.headers['x-payment'] ? 'present' : 'missing';
    console.log(`[DYNAMIC_PRICING]   - X-PAYMENT header: ${hasPaymentHeader}`);
    
    await dynamicPaymentMiddleware(req, res, next);
    
    // Log the response status after middleware completes
    if (res.headersSent) {
      if (res.statusCode === 402) {
        console.log(`[DYNAMIC_PRICING] ⚠ Payment required (402) - X-PAYMENT header missing or invalid`);
      } else if (res.statusCode === 200) {
        console.log(`[DYNAMIC_PRICING] ✓ Payment verified successfully (200)`);
      } else {
        console.log(`[DYNAMIC_PRICING] Response status: ${res.statusCode}`);
      }
    } else {
      console.log(`[DYNAMIC_PRICING] Response not sent yet (middleware passed to next handler)`);
    }
    console.log(`[DYNAMIC_PRICING] ========================================`);
  } catch (error: any) {
    console.error(`[DYNAMIC_PRICING] Error in dynamic pricing middleware:`, error);
    console.error(`[DYNAMIC_PRICING] Error stack:`, error.stack);
    // If we can't get file size, fall back to a default price or error
    res.status(500).json({
      error: "Failed to calculate price",
      message: error.message || "Could not fetch file metadata",
    });
  }
}

export function setupPaymentMiddleware(app: express.Application) {
  // Apply dynamic pricing middleware for /download
  app.use(dynamicPricingMiddleware);
  
  // For other endpoints, you can add static pricing here if needed
  // app.use(
  //   paymentMiddleware(
  //     payTo,
  //     {
  //       "GET /other-endpoint": {
  //         price: "$0.001",
  //         network: "base-sepolia",
  //       },
  //     },
  //     {
  //       url: facilitatorUrl,
  //     },
  //   ),
  // );
}

