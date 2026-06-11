import { redis } from "../config/redis.js";
import { logger } from "../config/logger.js";
import { env } from "../config/env.js";
import { KEYS } from "./keys.js";

// ── Online-presence helpers ───────────────────────────────────────────────────
// All user-online-status reads/writes go through here.

export async function markUserOnline(userId: string): Promise<void> {
  const key = KEYS.onlineUsers();
  await redis.sadd(key, userId);

  if (env.REDIS_DEBUG) {
    logger.info("Redis debug: SADD", { key, userId, members: await redis.smembers(key) });
  }
}

export async function markUserOffline(userId: string): Promise<void> {
  const key = KEYS.onlineUsers();
  await redis.srem(key, userId);

  if (env.REDIS_DEBUG) {
    logger.info("Redis debug: SREM", { key, userId, members: await redis.smembers(key) });
  }
}

export async function getOnlineUsers(): Promise<string[]> {
  return redis.smembers(KEYS.onlineUsers());
}

export async function isUserOnline(userId: string): Promise<boolean> {
  return (await redis.sismember(KEYS.onlineUsers(), userId)) === 1;
}

