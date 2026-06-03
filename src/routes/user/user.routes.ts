import { Router } from "express";
import { validate } from "../../middleware/validate.js";
import { requireAuth } from "../../middleware/requireAuth.js";
import { syncUserSchema } from "../../schemas/user/user.schemas.js";
import {
  syncUserController,
  listUsersController,
  getUserController,
} from "../../controllers/user/user.controller.js";

export const userRouter = Router();

// Sync Clerk user to DB — must be called by the UI after every login
userRouter.post(
  "/sync",
  requireAuth,
  validate({ body: syncUserSchema }),
  syncUserController
);

// List all users with online status
userRouter.get("/", requireAuth, listUsersController);

// Get a single user
userRouter.get("/:userId", requireAuth, getUserController);
