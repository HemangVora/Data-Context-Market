import express from "express";
import { paymentMiddleware, Resource, type SolanaAddress } from "x402-express";
import { facilitatorUrl, payTo } from "./config.js";

export function setupPaymentMiddleware(app: express.Application) {
  app.use(
    paymentMiddleware(
      payTo,
      {
        "GET /download": {
          // USDC amount in dollars
          price: "$0.001",
          // network: "base" // uncomment for Base mainnet
          // network: "solana" // uncomment for Solana mainnet
          network: "base-sepolia",
        },
      },
      {
        url: facilitatorUrl,
      },
    ),
  );
}

