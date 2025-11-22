import express from "express";
import { setupPaymentMiddleware } from "./middleware.js";
import routes from "./routes.js";
import { port } from "./config.js";

const app = express();

// Parse JSON bodies
app.use(express.json());

// Setup payment middleware
setupPaymentMiddleware(app);

// Setup routes
app.use("/", routes);

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});

