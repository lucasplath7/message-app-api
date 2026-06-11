import type { Server as SocketServer, Socket } from "socket.io";
import { addTypingUser, removeTypingUser } from "../typing.js";
import { broadcastTyping, threadRoom } from "../socket-rooms.js";
import type { SocketContext } from "../socket-context.js";
import { logger } from "../../config/logger.js";

// ── Thread socket handler ─────────────────────────────────────────────────────
// Covers: thread:join, thread:leave, thread:typing:start, thread:typing:stop.

export function registerThreadHandler(
  io: SocketServer,
  socket: Socket,
  ctx: SocketContext,
): void {
  // ── thread:join ───────────────────────────────────────────────────────────
  socket.on("thread:join", ({ threadId }: { threadId: string }) => {
    if (!threadId) return;
    socket.join(threadRoom(threadId));
    logger.info("Socket joined thread room", { socketId: socket.id, threadId });
  });

  // ── thread:leave ──────────────────────────────────────────────────────────
  socket.on("thread:leave", async ({ threadId }: { threadId: string }) => {
    if (!threadId) return;
    socket.leave(threadRoom(threadId));

    const userId = ctx.socketToUser.get(socket.id);
    if (userId) {
      await removeTypingUser(threadId, userId);
      ctx.socketTypingThreads.get(socket.id)?.delete(threadId);
      await broadcastTyping(io, threadId);
    }
  });

  // ── thread:typing:start ───────────────────────────────────────────────────
  socket.on("thread:typing:start", async ({ threadId }: { threadId: string }) => {
    const userId = ctx.socketToUser.get(socket.id);
    if (!userId || !threadId) return;

    await addTypingUser(threadId, userId);

    if (!ctx.socketTypingThreads.has(socket.id)) ctx.socketTypingThreads.set(socket.id, new Set());
    ctx.socketTypingThreads.get(socket.id)!.add(threadId);

    await broadcastTyping(io, threadId);
  });

  // ── thread:typing:stop ────────────────────────────────────────────────────
  socket.on("thread:typing:stop", async ({ threadId }: { threadId: string }) => {
    const userId = ctx.socketToUser.get(socket.id);
    if (!userId || !threadId) return;

    await removeTypingUser(threadId, userId);
    ctx.socketTypingThreads.get(socket.id)?.delete(threadId);

    await broadcastTyping(io, threadId);
  });
}

