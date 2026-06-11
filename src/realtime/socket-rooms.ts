import type { Server as SocketServer } from "socket.io";
import { getTypingUsers } from "./typing.js";

// ── Room name helpers ─────────────────────────────────────────────────────────
// Keep room name construction in one place so a naming change is one edit.

export const threadRoom = (threadId: string) => `thread:${threadId}`;
export const userRoom   = (userId:   string) => `user:${userId}`;

// ── Shared socket broadcast helpers ──────────────────────────────────────────

export async function broadcastTyping(io: SocketServer, threadId: string): Promise<void> {
  const typingUserIds = await getTypingUsers(threadId);
  io.to(threadRoom(threadId)).emit("thread:typing", { threadId, typingUserIds });
}

