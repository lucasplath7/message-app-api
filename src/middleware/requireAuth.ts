import type { NextFunction, Request, Response } from "express";
import { getAuth } from "@clerk/express";
import { AppError } from "../utils/appError.js";

/**
 * Requires a valid Clerk session token.
 * Populates res.locals.userId with the Clerk user ID.
 * Throws 401 if unauthenticated.
 */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const { userId } = getAuth(req);

  if (!userId) {
    return next(new AppError(401, "Unauthorized"));
  }

  // Make userId easily available in subsequent handlers via res.locals
  _res.locals.userId = userId;
  next();
}



