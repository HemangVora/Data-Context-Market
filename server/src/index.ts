import express from "express";
import { setupPaymentMiddleware } from "./middleware.js";
import routes from "./routes.js";
import { port } from "./config.js";

const app = express();

// CORS configuration
app.use((req, res, next) => {
  const allowedOrigins = [
    "https://ui-databox.up.railway.app",
    "http://localhost:3000",
    "http://localhost:3001",
  ];

  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }

  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Requested-With, X-PAYMENT",
  );
  res.setHeader("Access-Control-Allow-Credentials", "true");

  // Handle preflight requests
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  next();
});

// Parse JSON bodies
app.use(express.json());

// Setup payment middleware
setupPaymentMiddleware(app);

// Setup routes
app.use("/", routes);

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});
