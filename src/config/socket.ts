import type { Server as HttpServer } from "http";
import { Server as SocketServer } from "socket.io";
import { redis, redisSub } from "./redis.js";
import { KEYS } from "../realtime/keys.js";
import { logger } from "./logger.js";
import { env } from "./env.js";
import { createSocketContext } from "../realtime/socket-context.js";
import { registerUserHandler } from "../realtime/handlers/user.handler.js";
import { registerThreadHandler } from "../realtime/handlers/thread.handler.js";
import type { ChannelHandler } from "../realtime/channel-handler.js";
import { threadChannel } from "../realtime/channels/thread.channel.js";
import { userStatusChannel } from "../realtime/channels/user.channel.js";

export let io: SocketServer;

// ── Channel handler registry ──────────────────────────────────────────────────
// To add a new channel concern:
//   1. Add a channel name to src/realtime/channels.ts
//   2. Create src/realtime/channels/<concern>.channel.ts implementing ChannelHandler
//   3. Add it to this array — nothing else needs to change
const channelHandlers: ChannelHandler[] = [
  threadChannel,
  userStatusChannel,
];

export async function initSocket(httpServer: HttpServer): Promise<SocketServer> {
  // Clear any stale online-user data left from a previous process run
  await redis.del(KEYS.onlineUsers());

  io = new SocketServer(httpServer, {
    cors: { origin: "*", methods: ["GET", "POST"] },
  });

  // ── Subscribe to every channel declared by the registered handlers ─────────
  const allChannels = channelHandlers.flatMap((h) => [...h.channels]);
  await redisSub.subscribe(...allChannels);

  redisSub.on("message", (channel: string, raw: string) => {
    try {
      const payload = JSON.parse(raw);

      if (env.REDIS_DEBUG) {
        logger.info("Redis debug: SUBSCRIBE message", { channel, payload });
      }

      for (const handler of channelHandlers) {
        if ((handler.channels as readonly string[]).includes(channel)) {
          void Promise.resolve(handler.handle(io, channel, payload)).catch((err) =>
            logger.error("Channel handler error", { channel, err }),
          );
        }
      }
    } catch (err) {
      logger.error("Socket: failed to process Redis message", err);
    }
  });

  // ── Register socket event handlers ────────────────────────────────────────
  // To add a new group of socket events:
  //   1. Create src/realtime/handlers/<concern>.handler.ts
  //   2. Call registerXxxHandler(io, socket, ctx) below
  const ctx = createSocketContext();

  io.on("connection", (socket) => {
    logger.info("Socket client connected", { id: socket.id });
    registerUserHandler(io, socket, ctx);
    registerThreadHandler(io, socket, ctx);
  });

  return io;
}
