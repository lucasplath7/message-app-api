import { Router } from "express";
import { validate } from "../../middleware/validate.js";
import { requireAuth } from "../../middleware/requireAuth.js";
import {
  createMessageSchema,
  getMessagesQuerySchema,
} from "../../schemas/message/message.schemas.js";
import { threadIdParamSchema } from "../../schemas/thread/thread.schemas.js";
import {
  createMessageController,
  getMessagesController,
} from "../../controllers/message/message.controller.js";

// mergeParams: true so :threadId from the parent router is accessible
export const messageRouter = Router({ mergeParams: true });

// Get messages for a thread (with optional cursor-based pagination)
messageRouter.get(
  "/",
  requireAuth,
  validate({ params: threadIdParamSchema, query: getMessagesQuerySchema }),
  getMessagesController
);

// Post a new message to a thread
messageRouter.post(
  "/",
  requireAuth,
  validate({ params: threadIdParamSchema, body: createMessageSchema }),
  createMessageController
);

