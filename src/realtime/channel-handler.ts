import type { Server as SocketServer } from "socket.io";

// ── ChannelHandler contract ───────────────────────────────────────────────────
// Implement this interface to handle one or more Redis pub/sub channels.
// Register the handler in src/config/socket.ts — no other changes required.
//
// Example:
//   export const myChannel: ChannelHandler = {
//     channels: [CHANNELS.MY_CHANNEL],
//     handle(io, channel, payload) { ... },
//   };

export interface ChannelHandler {
  /** Redis pub/sub channel names this handler subscribes to. */
  readonly channels: readonly string[];

  /**
   * Called for every message received on any of the registered channels.
   * May return a Promise — errors are caught by the orchestrator.
   */
  handle(io: SocketServer, channel: string, payload: unknown): void | Promise<void>;
}

