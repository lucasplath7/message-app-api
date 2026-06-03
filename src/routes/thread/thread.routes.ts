import { Router } from "express";
import { validate } from "../../middleware/validate.js";
import { requireAuth } from "../../middleware/requireAuth.js";
import {
  createThreadSchema,
  threadIdParamSchema,
} from "../../schemas/thread/thread.schemas.js";
import {
  createThreadController,
  listThreadsController,
  getThreadController,
} from "../../controllers/thread/thread.controller.js";

export const threadRouter = Router();

// Create a new thread (with recipients, subject, initial message)
threadRouter.post(
  "/",
  requireAuth,
  validate({ body: createThreadSchema }),
  createThreadController
);

// List all threads for the authenticated user
threadRouter.get("/", requireAuth, listThreadsController);

// Get a specific thread (participants, metadata)
threadRouter.get(
  "/:threadId",
  requireAuth,
  validate({ params: threadIdParamSchema }),
  getThreadController
);

