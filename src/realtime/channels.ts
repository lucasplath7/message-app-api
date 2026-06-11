// ── Redis pub/sub channel name registry ──────────────────────────────────────
// Add new channel names here as new concerns are introduced.
// Each channel should correspond to exactly one ChannelHandler in channels/.

export const CHANNELS = {
  THREAD_NEW:  "messaging:thread:new",
  MESSAGE_NEW: "messaging:message:new",
  USER_STATUS: "messaging:user:status",
} as const;

export type ChannelName = typeof CHANNELS[keyof typeof CHANNELS];

