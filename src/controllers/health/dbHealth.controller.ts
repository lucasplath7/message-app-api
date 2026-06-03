import type { Request, Response } from "express";
import { db } from "../../config/db.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

export const dbHealthCheckController = asyncHandler(async (_req: Request, res: Response) => {
  // Simple connectivity check — just verify the DB responds
  await db
    .selectFrom("messaging.users")
    .select("id")
    .limit(1)
    .execute();

  res.status(200).json({
    status: "ok",
    message: "Database is healthy",
    timestamp: new Date().toISOString()
  });
});
