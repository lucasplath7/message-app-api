import type { ColumnType, Generated } from "kysely";

// Timestamps are auto-managed by the DB trigger; never set manually on insert.
type Timestamp = ColumnType<Date, never, never>;

// ── messaging.users ──────────────────────────────────────────────
export interface UsersTable {
  id: string;            // Clerk user ID (provided on insert)
  email: string;
  username: string;
  image_url: string | null;
  created_at: Timestamp;
  updated_at: Timestamp;
}

// ── messaging.threads ────────────────────────────────────────────
export interface ThreadsTable {
  id: Generated<string>;
  subject: string;
  created_by: string;    // FK → messaging.users.id
  created_at: Timestamp;
  updated_at: Timestamp;
}

// ── messaging.thread_participants ────────────────────────────────
export interface ThreadParticipantsTable {
  thread_id: string;     // FK → messaging.threads.id
  user_id: string;       // FK → messaging.users.id
  joined_at: Timestamp;
}

// ── messaging.messages ───────────────────────────────────────────
export interface MessagesTable {
  id: Generated<string>;
  thread_id: string;     // FK → messaging.threads.id
  sender_id: string;     // FK → messaging.users.id
  body: string;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface DB {
  "messaging.users": UsersTable;
  "messaging.threads": ThreadsTable;
  "messaging.thread_participants": ThreadParticipantsTable;
  "messaging.messages": MessagesTable;
}
