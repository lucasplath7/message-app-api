// ── Redis key helpers ─────────────────────────────────────────────────────────
// Centralised so key names are never scattered across the codebase.

export const KEYS = {
  onlineUsers:  ()               => "messaging:online_users",
  threadTyping: (threadId: string) => `messaging:thread:${threadId}:typing`,
} as const;

