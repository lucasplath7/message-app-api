import { redis } from "../config/redis.js";
import { logger } from "../config/logger.js";
import { env } from "../config/env.js";
import { KEYS } from "./keys.js";

// ── Typing-indicator helpers ──────────────────────────────────────────────────
// Uses a Redis ZSET where the score is the expiry timestamp (ms).
// Stale entries are pruned lazily on every read.

const TYPING_TTL_MS = 10_000;

async function getTypingSnapshot(threadId: string): Promise<Array<{ userId: string; expiryMs: number }>> {
  const key = KEYS.threadTyping(threadId);
  const raw = await redis.zrange(key, 0, -1, "WITHSCORES");
  const snapshot: Array<{ userId: string; expiryMs: number }> = [];
  for (let i = 0; i < raw.length; i += 2) {
    snapshot.push({ userId: raw[i], expiryMs: Number(raw[i + 1]) });
  }
  return snapshot;
}

export async function addTypingUser(threadId: string, userId: string): Promise<void> {
  const expiry = Date.now() + TYPING_TTL_MS;
  const key = KEYS.threadTyping(threadId);
  await redis.zadd(key, expiry, userId);

  if (env.REDIS_DEBUG) {
    logger.info("Redis debug: ZADD", { key, threadId, userId, expiry, members: await getTypingSnapshot(threadId) });
  }
}

export async function removeTypingUser(threadId: string, userId: string): Promise<void> {
  const key = KEYS.threadTyping(threadId);
  await redis.zrem(key, userId);

  if (env.REDIS_DEBUG) {
    logger.info("Redis debug: ZREM", { key, threadId, userId, members: await getTypingSnapshot(threadId) });
  }
}

export async function getTypingUsers(threadId: string): Promise<string[]> {
  const now = Date.now();
  const key = KEYS.threadTyping(threadId);
  const removed = await redis.zremrangebyscore(key, "-inf", now);
  const members = await redis.zrange(key, 0, -1);

  if (removed > 0 && env.REDIS_DEBUG) {
    logger.info("Redis debug: ZREMRANGEBYSCORE", { key, threadId, removed, maxScore: now, members });
  }

  return members;
}

export async function clearTypingForSocket(threadIds: string[], userId: string): Promise<void> {
  await Promise.all(threadIds.map((tid) => removeTypingUser(tid, userId)));
}

