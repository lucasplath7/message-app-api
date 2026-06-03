import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { clerkMiddleware } from "@clerk/express";
import { healthRouter } from "./routes/health/health.routes.js";
import { apiRouter } from "./routes/index.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { notFoundHandler } from "./middleware/notFound.js";

export const app = express();

app.use(helmet());
app.use(cors());
app.use(morgan("dev"));
app.use(express.json());

// Public routes — mounted BEFORE Clerk middleware so they always work,
// even when CLERK_SECRET_KEY is a placeholder.
app.use("/api/health", healthRouter);

// Clerk auth middleware — attaches auth context to all remaining routes.
// Requires a valid CLERK_SECRET_KEY at runtime.
app.use(clerkMiddleware());

app.use("/api", apiRouter);

app.use(notFoundHandler);
app.use(errorHandler);
