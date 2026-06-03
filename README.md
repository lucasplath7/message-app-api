# Message App API

Real-time messaging backend built with **Node.js + TypeScript**, **Express**, **PostgreSQL (Kysely)**, **Redis (ioredis)**, and **Socket.io**. Authentication is handled by **Clerk**.

---

## Table of Contents

- [Architecture](#architecture)
- [Database Schema](#database-schema)
- [Environment Variables](#environment-variables)
- [Running the App](#running-the-app)
- [REST API](#rest-api)
- [Socket.io Events](#socketio-events)
- [Redis Keys & Channels](#redis-keys--channels)

---

## Architecture

```
React UI (Clerk session)
     │
     ├── REST calls (Bearer token → Clerk JWT)
     │        └── Express routes → controllers → PostgreSQL (Kysely)
     │                                         └── publish to Redis pub/sub
     │
     └── WebSocket (Socket.io)
              └── socket.ts subscribes to Redis → broadcasts to rooms
```

---

## Database Schema

Run `migrations/001_messaging_schema.sql` against your PostgreSQL instance once before starting the server.

| Table | Purpose |
|---|---|
| `messaging.users` | Clerk user profiles synced on every login |
| `messaging.threads` | Thread metadata (subject, creator) |
| `messaging.thread_participants` | Many-to-many: users ↔ threads |
| `messaging.messages` | Individual messages within a thread |

---

## Environment Variables

Create `.env.development` (and `.env.production` for prod) with:

```env
NODE_ENV=development
PORT=3001

# PostgreSQL
DB_URL=postgresql://user:password@host:5432/dbname

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password

# Clerk  (from https://dashboard.clerk.com)
CLERK_SECRET_KEY=sk_test_...
CLERK_PUBLISHABLE_KEY=pk_test_...   # optional, used by front-end
```

---

## Running the App

```bash
npm install
npm run dev       # development (tsx watch)
npm run build     # compile to dist/
npm start         # run compiled output
```

---

## REST API

All endpoints (except `/api/health`) require a valid Clerk session token in the `Authorization: Bearer <token>` header.

### Users

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/users/sync` | Upsert Clerk user into DB — call this after every login |
| `GET` | `/api/users` | List all users with online status |
| `GET` | `/api/users/:userId` | Get a single user with online status |

#### `POST /api/users/sync` body
```json
{
  "email": "alice@example.com",
  "username": "alice",
  "imageUrl": "https://..."
}
```

### Threads

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/threads` | Create a thread with 1–10 recipients and an initial message |
| `GET` | `/api/threads` | List threads for the authenticated user (sorted by latest activity) |
| `GET` | `/api/threads/:threadId` | Get a single thread (participants, metadata) |

#### `POST /api/threads` body
```json
{
  "subject": "Weekend plans",
  "recipientIds": ["user_clerk_id_1", "user_clerk_id_2"],
  "initialMessage": "Hey, are you free Saturday?"
}
```

### Messages

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/threads/:threadId/messages` | Get messages (50 latest; supports `?limit=` & `?before=<ISO timestamp>`) |
| `POST` | `/api/threads/:threadId/messages` | Post a new message to a thread |

#### `POST /api/threads/:threadId/messages` body
```json
{ "body": "Sounds great!" }
```

---

## Socket.io Events

The UI connects to the Socket.io server and immediately identifies the user.

### Client → Server

| Event | Payload | Description |
|---|---|---|
| `user:connect` | `{ userId: string }` | Identify the logged-in Clerk user. **Must be sent immediately after connecting.** |
| `thread:join` | `{ threadId: string }` | Subscribe to real-time updates for a thread |
| `thread:leave` | `{ threadId: string }` | Unsubscribe from a thread's updates |
| `thread:typing:start` | `{ threadId: string }` | Notify others that this user is composing |
| `thread:typing:stop` | `{ threadId: string }` | Notify others that this user stopped composing |

### Server → Client

| Event | Payload | Description |
|---|---|---|
| `users:online` | `{ userIds: string[] }` | Full list of currently online user IDs (sent on connect) |
| `user:status` | `{ userId: string, online: boolean }` | Broadcast whenever any user goes on/offline |
| `thread:new` | thread object | Sent to each participant's personal room when a new thread is created |
| `thread:message:new` | `{ threadId: string, message: object }` | Sent to the thread room when a new message is posted |
| `thread:typing` | `{ threadId: string, typingUserIds: string[] }` | Live list of users currently composing in a thread (auto-expires after 10 s) |

### Connection flow (UI pseudocode)

```ts
const socket = io(API_URL);

socket.on("connect", () => {
  socket.emit("user:connect", { userId: clerkUser.id });
});

// When the user opens a thread:
socket.emit("thread:join", { threadId });

// While typing:
socket.emit("thread:typing:start", { threadId });
socket.emit("thread:typing:stop", { threadId });

// Listeners:
socket.on("thread:message:new", ({ threadId, message }) => { /* update UI */ });
socket.on("thread:typing",      ({ threadId, typingUserIds }) => { /* show "X is typing…" */ });
socket.on("user:status",        ({ userId, online }) => { /* update presence badge */ });
socket.on("thread:new",         (thread) => { /* prepend to thread list */ });
```

---

## Redis Keys & Channels

### Keys

| Key | Type | Description |
|---|---|---|
| `messaging:online_users` | SET | Clerk user IDs of connected users |
| `messaging:thread:{threadId}:typing` | ZSET | Users typing; score = expiry ms (auto-cleaned on read) |

### Pub/Sub Channels

| Channel | Publisher | Subscriber |
|---|---|---|
| `messaging:thread:new` | Thread controller | `socket.ts` → emits `thread:new` to participant rooms |
| `messaging:message:new` | Message controller | `socket.ts` → emits `thread:message:new` to thread room |
| `messaging:user:status` | `socket.ts` | `socket.ts` → broadcasts `user:status` to all clients |
