import * as ioredis from "ioredis";
import { env } from "./env.js";
import { logger } from "./logger.js";

// ── Pub/Sub channel names ────────────────────────────────────────
export const CHANNELS = {
  THREAD_NEW:     "messaging:thread:new",
  MESSAGE_NEW:    "messaging:message:new",
  USER_STATUS:    "messaging:user:status",
} as const;

// ── Redis key helpers ────────────────────────────────────────────
export const KEYS = {
  onlineUsers:      ()             => "messaging:online_users",
  threadTyping:     (threadId: string) => `messaging:thread:${threadId}:typing`,
} as const;

const redisConfig = {
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  password: env.REDIS_PASSWORD,
  lazyConnect: true
};

// Main client (commands)
export const redis = new ioredis.Redis(redisConfig);
// Dedicated subscriber client (cannot issue regular commands while subscribed)
export const redisSub = new ioredis.Redis(redisConfig);

redis.on("connect", () => logger.info("Redis client connected"));
redis.on("error", (err: Error) => logger.error("Redis client error", err));

redisSub.on("connect", () => logger.info("Redis subscriber connected"));
redisSub.on("error", (err: Error) => logger.error("Redis subscriber error", err));

// ── Online-status helpers ────────────────────────────────────────
export async function markUserOnline(userId: string): Promise<void> {
  await redis.sadd(KEYS.onlineUsers(), userId);
}

export async function markUserOffline(userId: string): Promise<void> {
  await redis.srem(KEYS.onlineUsers(), userId);
}

export async function getOnlineUsers(): Promise<string[]> {
  return redis.smembers(KEYS.onlineUsers());
}

export async function isUserOnline(userId: string): Promise<boolean> {
  return (await redis.sismember(KEYS.onlineUsers(), userId)) === 1;
}

// ── Typing-indicator helpers (ZSET, score = expiry ms) ───────────
const TYPING_TTL_MS = 10_000;

export async function addTypingUser(threadId: string, userId: string): Promise<void> {
  const expiry = Date.now() + TYPING_TTL_MS;
  await redis.zadd(KEYS.threadTyping(threadId), expiry, userId);
}

export async function removeTypingUser(threadId: string, userId: string): Promise<void> {
  await redis.zrem(KEYS.threadTyping(threadId), userId);
}

export async function getTypingUsers(threadId: string): Promise<string[]> {
  const now = Date.now();
  // Remove stale entries then return active ones
  await redis.zremrangebyscore(KEYS.threadTyping(threadId), "-inf", now);
  return redis.zrange(KEYS.threadTyping(threadId), 0, -1);
}

export async function clearTypingForSocket(threadIds: string[], userId: string): Promise<void> {
  await Promise.all(threadIds.map((tid) => removeTypingUser(tid, userId)));
}

// ── Publish helpers ──────────────────────────────────────────────
export async function publish(channel: string, payload: unknown): Promise<void> {
  await redis.publish(channel, JSON.stringify(payload));
}
