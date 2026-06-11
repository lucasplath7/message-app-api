import type { Server as SocketServer } from "socket.io";
import type { ChannelHandler } from "../channel-handler.js";
import { CHANNELS } from "../channels.js";

// ── User-status channel handler ───────────────────────────────────────────────
// Routes USER_STATUS pub/sub messages to all connected socket clients.
// Useful in multi-process deployments where status changes originate elsewhere.
//
// USER_STATUS → broadcasts "user:status" to every connected client

export const userStatusChannel: ChannelHandler = {
  channels: [CHANNELS.USER_STATUS],

  handle(io: SocketServer, channel: string, payload: unknown): void {
    if (channel === CHANNELS.USER_STATUS) {
      const { userId, online } = payload as { userId: string; online: boolean };
      io.emit("user:status", { userId, online });
    }
  },
};

