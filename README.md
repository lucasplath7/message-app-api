# template-app-api

A template Node.js REST API demonstrating essential patterns for building scalable, maintainable applications with Express, TypeScript, and modern tooling.

## Purpose

This project serves as a reference template showcasing common architectural patterns that can be adopted when starting new API projects. Clone it, strip what you don't need, and build on top of a solid foundation.

## Patterns Demonstrated

- **Type-safe API** – Strict TypeScript configuration throughout
- **Resource-based modules** – Routes, controllers, and schemas co-located by feature
- **Request validation** – Input validation using Zod schemas
- **Centralized error handling** – Unified error and not-found middleware
- **Security & logging** – `helmet`, `cors`, and `morgan` pre-configured
- **Database access** – PostgreSQL via `kysely` query builder
- **Caching** – Redis integration via `ioredis`
- **Real-time** – WebSocket support via `socket.io`
- **Async handling** – `asyncHandler` wrapper to eliminate try/catch boilerplate
- **Environment config** – Validated environment variables with `dotenv`
- **Testing** – Unit/integration tests with Vitest and Supertest

## Project Structure

```text
src/
  config/          # DB, Redis, Socket.io, env, and logger setup
  controllers/     # Feature controllers (health, user, counter, …)
  middleware/      # errorHandler, notFound, validate
  routes/          # Express routers grouped by feature
  schemas/         # Zod validation schemas
  types/           # Shared TypeScript types
  utils/           # appError, asyncHandler helpers
  app.ts           # Express app setup
  server.ts        # HTTP server entry point
tests/             # Vitest + Supertest test suites
```

## Quick Start

```bash
npm install
npm run dev
```

API base URL: `http://localhost:3000/api`

## Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start development server with hot reload (tsx watch) |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm run start` | Run the compiled server |
| `npm run test` | Run tests once |
| `npm run test:watch` | Run tests in watch mode |

## Endpoints

### Health

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/health` | Liveness check |
| `GET` | `/api/health/db` | Database connectivity check |

### Users

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/users` | List users |
| `POST` | `/api/users` | Create a user |

### Counter

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/counter` | Get current counter value |
| `POST` | `/api/counter` | Increment counter |

## Tech Stack

- **Runtime** – Node.js ≥ 20
- **Framework** – Express 4
- **Language** – TypeScript 5
- **Validation** – Zod
- **Database** – PostgreSQL + Kysely
- **Cache** – Redis (ioredis)
- **Real-time** – Socket.io
- **Testing** – Vitest + Supertest
