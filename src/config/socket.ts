import type { Server as HttpServer } from "http";
import { Server as SocketServer } from "socket.io";
import {
  redis,
  redisSub,
  CHANNELS,
  markUserOnline,
  markUserOffline,
  getOnlineUsers,
  addTypingUser,
  removeTypingUser,
  getTypingUsers,
  KEYS,
} from "./redis.js";
import { logger } from "./logger.js";

export let io: SocketServer;

/**
 * In-memory maps for the lifetime of this process.
 * socket.id → clerkUserId
 * clerkUserId → Set<socket.id>   (a user may have multiple tabs)
 * socket.id → Set<threadId>      (threads this socket is typing in)
 */
const socketToUser = new Map<string, string>();
const userToSockets = new Map<string, Set<string>>();
const socketTypingThreads = new Map<string, Set<string>>();

// ── Helpers ──────────────────────────────────────────────────────

function userRoom(userId: string) {
  return `user:${userId}`;
}

function threadRoom(threadId: string) {
  return `thread:${threadId}`;
}

async function broadcastTyping(threadId: string) {
  const typingUserIds = await getTypingUsers(threadId);
  io.to(threadRoom(threadId)).emit("thread:typing", { threadId, typingUserIds });
}

async function broadcastOnlineStatus(userId: string, online: boolean) {
  io.emit("user:status", { userId, online });
}

// ── Init ─────────────────────────────────────────────────────────

export async function initSocket(httpServer: HttpServer): Promise<SocketServer> {
  // Clear stale online-user data from a previous process run
  await redis.del(KEYS.onlineUsers());

  io = new SocketServer(httpServer, {
    cors: { origin: "*", methods: ["GET", "POST"] },
  });

  // ── Subscribe to Redis pub/sub channels ───────────────────────
  await redisSub.subscribe(
    CHANNELS.THREAD_NEW,
    CHANNELS.MESSAGE_NEW,
    CHANNELS.USER_STATUS,
  );

  redisSub.on("message", (channel: string, raw: string) => {
    try {
      const payload = JSON.parse(raw);

      if (channel === CHANNELS.THREAD_NEW) {
        // Notify every participant via their personal room
        const { thread, participantIds } = payload as {
          thread: unknown;
          participantIds: string[];
        };
        for (const uid of participantIds) {
          io.to(userRoom(uid)).emit("thread:new", thread);
        }
      }

      if (channel === CHANNELS.MESSAGE_NEW) {
        const { threadId, message } = payload as {
          threadId: string;
          message: unknown;
        };
        io.to(threadRoom(threadId)).emit("thread:message:new", { threadId, message });
      }

      if (channel === CHANNELS.USER_STATUS) {
        const { userId, online } = payload as { userId: string; online: boolean };
        io.emit("user:status", { userId, online });
      }
    } catch (err) {
      logger.error("Socket: failed to process Redis message", err);
    }
  });

  // ── Connection handler ────────────────────────────────────────
  io.on("connection", (socket) => {
    logger.info("Socket client connected", { id: socket.id });

    // ── user:connect ─────────────────────────────────────────────
    // Client must emit this immediately after connecting with their Clerk userId.
    socket.on("user:connect", async ({ userId }: { userId: string }) => {
      if (!userId) return;

      // Register mappings
      socketToUser.set(socket.id, userId);
      if (!userToSockets.has(userId)) userToSockets.set(userId, new Set());
      userToSockets.get(userId)!.add(socket.id);

      // Join personal room
      socket.join(userRoom(userId));

      // Mark online (only emit status change when first socket for this user)
      const wasAlreadyOnline = userToSockets.get(userId)!.size > 1;
      await markUserOnline(userId);

      if (!wasAlreadyOnline) {
        await broadcastOnlineStatus(userId, true);
      }

      // Send current online user list to the connecting socket
      const onlineUserIds = await getOnlineUsers();
      socket.emit("users:online", { userIds: onlineUserIds });

      logger.info("User identified on socket", { userId, socketId: socket.id });
    });

    // ── thread:join ──────────────────────────────────────────────
    socket.on("thread:join", ({ threadId }: { threadId: string }) => {
      if (!threadId) return;
      socket.join(threadRoom(threadId));
      logger.info("Socket joined thread room", { socketId: socket.id, threadId });
    });

    // ── thread:leave ─────────────────────────────────────────────
    socket.on("thread:leave", async ({ threadId }: { threadId: string }) => {
      if (!threadId) return;
      socket.leave(threadRoom(threadId));

      // Clean up typing indicator if applicable
      const userId = socketToUser.get(socket.id);
      if (userId) {
        await removeTypingUser(threadId, userId);
        socketTypingThreads.get(socket.id)?.delete(threadId);
        await broadcastTyping(threadId);
      }
    });

    // ── thread:typing:start ──────────────────────────────────────
    socket.on("thread:typing:start", async ({ threadId }: { threadId: string }) => {
      const userId = socketToUser.get(socket.id);
      if (!userId || !threadId) return;

      await addTypingUser(threadId, userId);

      if (!socketTypingThreads.has(socket.id)) socketTypingThreads.set(socket.id, new Set());
      socketTypingThreads.get(socket.id)!.add(threadId);

      await broadcastTyping(threadId);
    });

    // ── thread:typing:stop ───────────────────────────────────────
    socket.on("thread:typing:stop", async ({ threadId }: { threadId: string }) => {
      const userId = socketToUser.get(socket.id);
      if (!userId || !threadId) return;

      await removeTypingUser(threadId, userId);
      socketTypingThreads.get(socket.id)?.delete(threadId);

      await broadcastTyping(threadId);
    });

    // ── disconnect ───────────────────────────────────────────────
    socket.on("disconnect", async () => {
      logger.info("Socket client disconnected", { id: socket.id });

      const userId = socketToUser.get(socket.id);
      socketToUser.delete(socket.id);

      if (userId) {
        const sockets = userToSockets.get(userId);
        if (sockets) {
          sockets.delete(socket.id);
          if (sockets.size === 0) {
            // Last connection for this user — mark offline
            userToSockets.delete(userId);
            await markUserOffline(userId);
            await broadcastOnlineStatus(userId, false);
          }
        }

        // Clean up all typing indicators for this socket
        const typingThreads = socketTypingThreads.get(socket.id);
        if (typingThreads) {
          await Promise.all(
            [...typingThreads].map(async (tid) => {
              await removeTypingUser(tid, userId);
              await broadcastTyping(tid);
            }),
          );
          socketTypingThreads.delete(socket.id);
        }
      }
    });
  });

  return io;
}
