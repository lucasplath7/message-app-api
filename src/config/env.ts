import dotenv from "dotenv";
import { z } from "zod";

const nodeEnv = process.env.NODE_ENV ?? "development";
dotenv.config({ path: `.env.${nodeEnv}` });

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3001),
  DB_URL: z.string().url("DB_URL must be a valid connection URL"),
  REDIS_HOST: z.string().min(1, "REDIS_HOST is required"),
  REDIS_PORT: z.coerce.number().int().positive().default(6379),
  REDIS_PASSWORD: z.string().min(1, "REDIS_PASSWORD is required"),
  REDIS_DEBUG: z
    .string()
    .optional()
    .transform((value) => value === "1" || value?.toLowerCase() === "true"),
  CLERK_SECRET_KEY: z.string().min(1, "CLERK_SECRET_KEY is required"),
  CLERK_PUBLISHABLE_KEY: z.string().min(1, "CLERK_PUBLISHABLE_KEY is required").optional()
});

export const env = envSchema.parse(process.env);
