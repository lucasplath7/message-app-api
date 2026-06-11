import { redis } from "../config/redis.js";
import { logger } from "../config/logger.js";
import { env } from "../config/env.js";

// ── Generic Redis publish helper ──────────────────────────────────────────────
// Controllers import this instead of touching the Redis client directly.

export async function publish(channel: string, payload: unknown): Promise<void> {
  await redis.publish(channel, JSON.stringify(payload));
  if (env.REDIS_DEBUG) {
    logger.info("Redis debug: PUBLISH", { channel, payload });
  }
}

