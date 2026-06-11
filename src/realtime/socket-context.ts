/**
 * Shared in-memory state for the lifetime of this process.
 *
 *  socketId   → clerkUserId            (quick reverse-lookup on disconnect)
 *  clerkUserId → Set<socketId>         (user may have multiple tabs open)
 *  socketId   → Set<threadId>          (threads this socket is currently typing in)
 */
export interface SocketContext {
  socketToUser:       Map<string, string>;
  userToSockets:      Map<string, Set<string>>;
  socketTypingThreads: Map<string, Set<string>>;
}

export function createSocketContext(): SocketContext {
  return {
    socketToUser:       new Map(),
    userToSockets:      new Map(),
    socketTypingThreads: new Map(),
  };
}

