import { z } from "zod";

export const createMessageSchema = z.object({
  body: z.string().min(1, "body is required"),
});

export const getMessagesQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(50),
  before: z.string().datetime().optional(), // ISO timestamp for cursor-based pagination
});

export type CreateMessageBody = z.infer<typeof createMessageSchema>;
export type GetMessagesQuery = z.infer<typeof getMessagesQuerySchema>;

