import type { Server as SocketServer, Socket } from "socket.io";
import { markUserOnline, markUserOffline, getOnlineUsers } from "../presence.js";
import { removeTypingUser } from "../typing.js";
import { broadcastTyping, userRoom } from "../socket-rooms.js";
import type { SocketContext } from "../socket-context.js";
import { logger } from "../../config/logger.js";

// ── User lifecycle socket handler ─────────────────────────────────────────────
// Covers: user:connect and disconnect.
// Typing-thread cleanup on disconnect is performed here because it requires
// knowledge of which threads the departing socket was active in.

export function registerUserHandler(
  io: SocketServer,
  socket: Socket,
  ctx: SocketContext,
): void {
  // ── user:connect ──────────────────────────────────────────────────────────
  // The client must emit this immediately after connecting with their Clerk userId.
  socket.on("user:connect", async ({ userId }: { userId: string }) => {
    if (!userId) return;

    // Register in-memory mappings
    ctx.socketToUser.set(socket.id, userId);
    if (!ctx.userToSockets.has(userId)) ctx.userToSockets.set(userId, new Set());
    ctx.userToSockets.get(userId)!.add(socket.id);

    // Join personal room so thread:new events can be targeted
    socket.join(userRoom(userId));

    // Only broadcast status change when this is the user's first socket
    const wasAlreadyOnline = ctx.userToSockets.get(userId)!.size > 1;
    await markUserOnline(userId);

    if (!wasAlreadyOnline) {
      io.emit("user:status", { userId, online: true });
    }

    // Send the full online list to the newly connected socket only
    const onlineUserIds = await getOnlineUsers();
    socket.emit("users:online", { userIds: onlineUserIds });

    logger.info("User identified on socket", { userId, socketId: socket.id });
  });

  // ── disconnect ────────────────────────────────────────────────────────────
  socket.on("disconnect", async () => {
    logger.info("Socket client disconnected", { id: socket.id });

    const userId = ctx.socketToUser.get(socket.id);
    ctx.socketToUser.delete(socket.id);

    if (!userId) return;

    // Remove this socket from the user's set; go offline only when last tab closes
    const sockets = ctx.userToSockets.get(userId);
    if (sockets) {
      sockets.delete(socket.id);
      if (sockets.size === 0) {
        ctx.userToSockets.delete(userId);
        await markUserOffline(userId);
        io.emit("user:status", { userId, online: false });
      }
    }

    // Clean up any typing indicators this socket left behind
    const typingThreads = ctx.socketTypingThreads.get(socket.id);
    if (typingThreads) {
      await Promise.all(
        [...typingThreads].map(async (tid) => {
          await removeTypingUser(tid, userId);
          await broadcastTyping(io, tid);
        }),
      );
      ctx.socketTypingThreads.delete(socket.id);
    }
  });
}

