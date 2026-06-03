import { z } from "zod";

export const createThreadSchema = z.object({
  subject: z
    .string()
    .min(1, "subject is required")
    .max(500, "subject must be at most 500 characters"),
  recipientIds: z
    .array(z.string().min(1))
    .min(1, "at least one recipient is required")
    .max(10, "at most 10 recipients are allowed"),
  initialMessage: z
    .string()
    .min(1, "initialMessage is required"),
});

export const threadIdParamSchema = z.object({
  threadId: z.string().uuid("threadId must be a valid UUID"),
});

export type CreateThreadBody = z.infer<typeof createThreadSchema>;
export type ThreadIdParam = z.infer<typeof threadIdParamSchema>;

