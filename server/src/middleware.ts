import express, { Request, Response, NextFunction } from "express";
import { paymentMiddleware, Resource, type SolanaAddress } from "x402-express";
import { facilitatorUrl } from "./config.js";
import { getDataFromContract } from "./services/contract.js";
import { RequestWithContractData } from "./types.js";
import { createErrorResponse } from "./utils/errors.js";

/**
 * Dynamic pricing middleware for /download endpoint
 * Fetches file size first, then applies x402 payment middleware with calculated price
 */
async function dynamicPricingMiddleware(
  req: RequestWithContractData,
  res: Response,
  next: NextFunction,
): Promise<void> {
  console.log(`[MIDDLEWARE] Incoming request: ${req.method} ${req.path}${req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : ''}`);
  
  // Only apply to /download endpoint (both /download and /download/:pieceCid)
  const isDownloadPath = req.path === "/download" || req.path.startsWith("/download/");
  console.log(`[MIDDLEWARE] Is download path: ${isDownloadPath}, method: ${req.method}`);
  
  if (!isDownloadPath || req.method !== "GET") {
    console.log(`[MIDDLEWARE] Skipping - not a download request`);
    return next();
  }

  // Extract pieceCid from path parameter or query parameter
  // For path params like /download/:pieceCid, we need to extract from the path string
  // since req.params isn't populated until after route matching
  let pieceCid: string | undefined;
  
  if (req.path.startsWith("/download/")) {
    // Extract from path: /download/bafkzcibcaabai3vffxbbuatysolo6sfd23ffr3e5r5t4wbccfootkd2pi6uyupi
    const pathParts = req.path.split("/");
    if (pathParts.length >= 3) {
      pieceCid = pathParts[2]; // Get the pieceCid from the path
    }
  } else {
    // Extract from query parameter: /download?pieceCid=...
    pieceCid = req.query.pieceCid as string;
  }
  
  if (!pieceCid) {
    // Let the route handler deal with missing pieceCid
    return next();
  }

  console.log(`[DYNAMIC_PRICING] ========================================`);
  console.log(`[DYNAMIC_PRICING] Starting payment middleware setup for PieceCID: ${pieceCid}`);
  console.log(`[DYNAMIC_PRICING] Request URL: ${req.protocol}://${req.headers.host}${req.path}${req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : ''}`);

  try {
    // First, check the contract for registered data - REQUIRED
    console.log(`[DYNAMIC_PRICING] Checking contract registry for PieceCID...`);
    const contractData = await getDataFromContract(pieceCid);
    
    if (!contractData) {
      console.log(`[DYNAMIC_PRICING] ✗ PieceCID not found in contract registry`);
      res.status(404).json({
        error: "PieceCID not registered",
        message: `The PieceCID "${pieceCid}" is not registered in the DataBoxRegistry contract. Please register it first before downloading.`,
        pieceCid: pieceCid,
      });
      return;
    }
    
    // Use price and payAddress from contract
    // Convert priceUSDC (6 decimals) to USD format for x402
    const priceInUSD = Number(contractData.priceUSDC) / 1_000_000;
    const dynamicPrice = `$${priceInUSD.toFixed(6)}`;
    const contractPayAddress = contractData.payAddress;
    
    console.log(`[DYNAMIC_PRICING] ✓ Found in contract registry:`);
    console.log(`[DYNAMIC_PRICING]   - Name: ${contractData.name}`);
    console.log(`[DYNAMIC_PRICING]   - Description: ${contractData.description}`);
    console.log(`[DYNAMIC_PRICING]   - Filetype: ${contractData.filetype}`);
    console.log(`[DYNAMIC_PRICING]   - Price from contract: ${dynamicPrice} (${contractData.priceUSDC} microUSDC)`);
    console.log(`[DYNAMIC_PRICING]   - Pay Address from contract: ${contractPayAddress}`);
    
    // Store in request for potential use
    req.dynamicPrice = dynamicPrice;
    req.contractData = contractData;

    // Use payAddress from contract
    const finalPayTo = contractPayAddress;
    
    // Create x402 middleware dynamically with price from contract
    console.log(`[DYNAMIC_PRICING] Creating x402 payment middleware...`);
    console.log(`[DYNAMIC_PRICING]   - Price: ${dynamicPrice} (from contract)`);
    console.log(`[DYNAMIC_PRICING]   - Network: base-sepolia`);
    console.log(`[DYNAMIC_PRICING]   - Pay to: ${finalPayTo} (from contract)`);
    console.log(`[DYNAMIC_PRICING]   - Facilitator: ${facilitatorUrl}`);
    
    const dynamicPaymentMiddleware = paymentMiddleware(
      finalPayTo as `0x${string}` | SolanaAddress,
      {
        "GET /download": {
          price: dynamicPrice,
          network: "base-sepolia",
        },
        "GET /download/*": {
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
    
    // Create a controlled next function that tracks when payment is verified
    // The x402 middleware will ONLY call next() after payment verification succeeds
    // If payment fails, the middleware sends a 402 and returns without calling next()
    let paymentVerified = false;
    const controlledNext: NextFunction = () => {
      // If this function is called, it means the x402 middleware verified payment
      // and is allowing the request to proceed to the route handler
      paymentVerified = true;
      console.log(`[DYNAMIC_PRICING] ✓ Payment verified by x402 middleware - calling route handler`);
      next();
    };
    
    try {
      // Execute the x402 payment middleware
      // This will:
      // 1. Check for X-PAYMENT header
      // 2. If missing/invalid: send 402 and return (doesn't call next())
      // 3. If valid: verify payment, then call next() to proceed to route handler
      await dynamicPaymentMiddleware(req, res, controlledNext);
      
      // After middleware completes, check what happened
      if (res.headersSent) {
        // A response was sent - check if it was a 402 (payment required)
        if (res.statusCode === 402) {
          console.log(`[DYNAMIC_PRICING] ⚠ Payment required (402) - request blocked`);
          console.log(`[DYNAMIC_PRICING] ========================================`);
          // Payment middleware sent 402, request is blocked - don't proceed
          return;
        }
        // If status is 200 and paymentVerified is true, route handler should have executed
        if (res.statusCode === 200 && paymentVerified) {
          console.log(`[DYNAMIC_PRICING] ✓ Payment verified (200) - route handler executed`);
        } else {
          console.log(`[DYNAMIC_PRICING] Unexpected state: status=${res.statusCode}, verified=${paymentVerified}`);
        }
        // If headers were sent but payment wasn't verified, stop here
        if (!paymentVerified) {
          console.log(`[DYNAMIC_PRICING] ⚠ Response sent but payment not verified - blocking request`);
          console.log(`[DYNAMIC_PRICING] ========================================`);
          return;
        }
      } else if (!paymentVerified) {
        // No response sent and payment not verified - this shouldn't happen
        // The x402 middleware should have either verified payment (calling next) or sent 402
        console.log(`[DYNAMIC_PRICING] ⚠ WARNING: Payment middleware completed but payment not verified and no response sent`);
        console.log(`[DYNAMIC_PRICING] This should not happen - blocking request as safety measure`);
        console.log(`[DYNAMIC_PRICING] ========================================`);
        if (!res.headersSent) {
          res.status(500).json(createErrorResponse("Payment verification error", "Payment middleware did not verify payment or send response"));
        }
        return;
      } else {
        // Payment verified but no response sent yet - route handler will send response
        console.log(`[DYNAMIC_PRICING] ✓ Payment verified - route handler will send response`);
      }
    } catch (middlewareError: unknown) {
      // If the payment middleware itself throws an error
      const errorMessage = middlewareError instanceof Error ? middlewareError.message : "Unknown error";
      console.error(`[DYNAMIC_PRICING] Error in payment middleware execution:`, errorMessage);
      if (!res.headersSent) {
        res.status(500).json(createErrorResponse("Payment middleware error", errorMessage));
      }
      console.log(`[DYNAMIC_PRICING] ========================================`);
      // Stop execution - don't continue to route handler
      return;
    }
    console.log(`[DYNAMIC_PRICING] ========================================`);
  } catch (error: unknown) {
    console.error(`[DYNAMIC_PRICING] Error in dynamic pricing middleware:`, error);
    const errorMessage = error instanceof Error ? error.message : "Could not fetch file metadata";
    // If we can't get file size, fall back to a default price or error
    if (!res.headersSent) {
      res.status(500).json(createErrorResponse("Failed to calculate price", errorMessage));
    }
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

