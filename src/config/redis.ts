import * as ioredis from "ioredis";
import { env } from "./env.js";
import { logger } from "./logger.js";

// ── Redis client instances ────────────────────────────────────────────────────
// Import these wherever a raw Redis command is needed.
// Higher-level helpers live in src/realtime/ (presence, typing, publish, …).

const redisConfig = {
  host:        env.REDIS_HOST,
  port:        env.REDIS_PORT,
  password:    env.REDIS_PASSWORD,
  lazyConnect: true,
};

// Main command client
export const redis = new ioredis.Redis(redisConfig);

// Dedicated subscriber client — cannot issue regular commands while subscribed
export const redisSub = new ioredis.Redis(redisConfig);

redis.on("connect", () => logger.info("Redis client connected"));
redis.on("error",   (err: Error) => logger.error("Redis client error", err));

redisSub.on("connect", () => logger.info("Redis subscriber connected"));
redisSub.on("error",   (err: Error) => logger.error("Redis subscriber error", err));
