import type { Server as SocketServer } from "socket.io";
import type { ChannelHandler } from "../channel-handler.js";
import { CHANNELS } from "../channels.js";
import { threadRoom, userRoom } from "../socket-rooms.js";

// ── Thread & Message channel handler ─────────────────────────────────────────
// Routes inbound Redis pub/sub messages to the appropriate socket rooms.
//
// THREAD_NEW  → emits "thread:new"         to each participant's personal room
// MESSAGE_NEW → emits "thread:message:new" to the thread's room

export const threadChannel: ChannelHandler = {
  channels: [CHANNELS.THREAD_NEW, CHANNELS.MESSAGE_NEW],

  handle(io: SocketServer, channel: string, payload: unknown): void {
    if (channel === CHANNELS.THREAD_NEW) {
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
  },
};

