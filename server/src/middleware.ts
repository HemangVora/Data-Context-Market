import express from "express";
import { paymentMiddleware, Resource, type SolanaAddress } from "x402-express";
import { facilitatorUrl, payTo } from "./config.js";

export function setupPaymentMiddleware(app: express.Application) {
  app.use(
    paymentMiddleware(
      payTo,
      {
        "GET /weather": {
          // USDC amount in dollars
          price: "$0.001",
          // network: "base" // uncomment for Base mainnet
          // network: "solana" // uncomment for Solana mainnet
          network: "base-sepolia",
        },
        "/premium/*": {
          // Define atomic amounts in any EIP-3009 token
          price: {
            amount: "100000",
            asset: {
              address: "0xabc",
              decimals: 18,
              // omit eip712 for Solana
              eip712: {
                name: "WETH",
                version: "1",
              },
            },
          },
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

