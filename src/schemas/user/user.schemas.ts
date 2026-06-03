import { z } from "zod";

export const syncUserSchema = z.object({
  email: z.string().email("email must be a valid email address"),
  username: z.string().min(1, "username is required"),
  imageUrl: z.string().url().optional().nullable(),
});

export type SyncUserBody = z.infer<typeof syncUserSchema>;

// Legacy — kept for backwards compat if anything still references it
export const createUserSchema = syncUserSchema;
export type CreateUserBody = SyncUserBody;
