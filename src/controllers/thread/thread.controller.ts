import type { Request, Response } from "express";
import { db } from "../../config/db.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { AppError } from "../../utils/appError.js";
import { publish } from "../../realtime/publish.js";
import { CHANNELS } from "../../realtime/channels.js";
import type { CreateThreadBody, ThreadIdParam } from "../../schemas/thread/thread.schemas.js";

// ── Shape helpers ────────────────────────────────────────────────

function mapUser(u: {
  id: string;
  email: string;
  username: string;
  image_url: string | null;
}) {
  return {
    id:       u.id,
    email:    u.email,
    username: u.username,
    imageUrl: u.image_url,
  };
}

// ── POST /api/threads ────────────────────────────────────────────
export const createThreadController = asyncHandler(
  async (req: Request<{}, {}, CreateThreadBody>, res: Response) => {
    const creatorId = res.locals.userId as string;
    const { subject, recipientIds, initialMessage } = req.body;

    // Ensure the creator is not duplicated in the participant list
    const participantIds = Array.from(new Set([creatorId, ...recipientIds]));

    if (participantIds.length > 11) {
      throw new AppError(400, "A thread can have at most 10 recipients (11 participants including creator)");
    }

    // Verify all referenced users exist
    const existingUsers = await db
      .selectFrom("messaging.users")
      .select("id")
      .where("id", "in", participantIds)
      .execute();

    const existingIds = new Set(existingUsers.map((u) => u.id));
    const missing = participantIds.filter((id) => !existingIds.has(id));
    if (missing.length > 0) {
      throw new AppError(400, `Users not found: ${missing.join(", ")}`);
    }

    // Run thread creation, participant inserts, and initial message in a transaction
    const result = await db.transaction().execute(async (trx) => {
      // Create thread
      const thread = await trx
        .insertInto("messaging.threads")
        .values({ subject, created_by: creatorId })
        .returning(["id", "subject", "created_by", "created_at", "updated_at"])
        .executeTakeFirstOrThrow();

      // Add all participants
      await trx
        .insertInto("messaging.thread_participants")
        .values(participantIds.map((uid) => ({ thread_id: thread.id, user_id: uid })))
        .execute();

      // Insert the initial message
      const message = await trx
        .insertInto("messaging.messages")
        .values({ thread_id: thread.id, sender_id: creatorId, body: initialMessage })
        .returning(["id", "thread_id", "sender_id", "body", "created_at", "updated_at"])
        .executeTakeFirstOrThrow();

      return { thread, message };
    });

    // Fetch full participant objects to return
    const participants = await db
      .selectFrom("messaging.users")
      .select(["id", "email", "username", "image_url"])
      .where("id", "in", participantIds)
      .execute();

    const creator = participants.find((p) => p.id === creatorId)!;

    const threadResponse = {
      id:          result.thread.id,
      subject:     result.thread.subject,
      createdAt:   result.thread.created_at,
      updatedAt:   result.thread.updated_at,
      createdBy:   mapUser(creator),
      participants: participants.map(mapUser),
      lastMessage: {
        id:        result.message.id,
        body:      result.message.body,
        senderId:  result.message.sender_id,
        createdAt: result.message.created_at,
      },
    };

    // Broadcast via Redis → socket server
    await publish(CHANNELS.THREAD_NEW, {
      thread:         threadResponse,
      participantIds,
    });

    res.status(201).json(threadResponse);
  }
);

// ── GET /api/threads ─────────────────────────────────────────────
export const listThreadsController = asyncHandler(
  async (_req: Request, res: Response) => {
    const userId = res.locals.userId as string;

    // 1. Get thread IDs where this user is a participant
    const participations = await db
      .selectFrom("messaging.thread_participants")
      .select("thread_id")
      .where("user_id", "=", userId)
      .execute();

    if (participations.length === 0) {
      res.json([]);
      return;
    }

    const threadIds = participations.map((p) => p.thread_id);

    // 2. Fetch threads
    const threads = await db
      .selectFrom("messaging.threads")
      .select(["id", "subject", "created_by", "created_at", "updated_at"])
      .where("id", "in", threadIds)
      .orderBy("updated_at", "desc")
      .execute();

    // 3. Fetch all participants for those threads in one query
    const allParticipants = await db
      .selectFrom("messaging.thread_participants as tp")
      .innerJoin("messaging.users as u", "u.id", "tp.user_id")
      .select(["tp.thread_id", "u.id", "u.email", "u.username", "u.image_url"])
      .where("tp.thread_id", "in", threadIds)
      .execute();

    // 4. Fetch the latest message per thread using DISTINCT ON via raw SQL approach
    //    We'll do a single query filtering by thread_id IN and pick max per thread.
    const latestMessages = await db
      .selectFrom("messaging.messages as m")
      .select(["m.id", "m.thread_id", "m.sender_id", "m.body", "m.created_at"])
      .where("m.thread_id", "in", threadIds)
      // Subquery: keep only the row with the max created_at per thread
      .where(({ eb }) =>
        eb("m.created_at", "=",
          eb
            .selectFrom("messaging.messages as m2")
            .select(({ fn }) => [fn.max("m2.created_at").as("max_at")])
            .whereRef("m2.thread_id", "=", "m.thread_id")
        )
      )
      .execute();

    // 5. Assemble
    const participantsByThread = new Map<string, typeof allParticipants>();
    for (const p of allParticipants) {
      if (!participantsByThread.has(p.thread_id)) {
        participantsByThread.set(p.thread_id, []);
      }
      participantsByThread.get(p.thread_id)!.push(p);
    }

    const latestByThread = new Map(latestMessages.map((m) => [m.thread_id, m]));

    // Build a map of userId -> user for creator lookup
    const userMap = new Map(allParticipants.map((p) => [p.id, p]));

    const result = threads.map((t) => {
      const participants = (participantsByThread.get(t.id) ?? []).map(mapUser);
      const lastMsg = latestByThread.get(t.id);
      const creator = userMap.get(t.created_by);

      return {
        id:           t.id,
        subject:      t.subject,
        createdAt:    t.created_at,
        updatedAt:    t.updated_at,
        createdBy:    creator ? mapUser(creator) : { id: t.created_by },
        participants,
        lastMessage:  lastMsg
          ? { id: lastMsg.id, body: lastMsg.body, senderId: lastMsg.sender_id, createdAt: lastMsg.created_at }
          : null,
      };
    });

    res.json(result);
  }
);

// ── GET /api/threads/:threadId ───────────────────────────────────
export const getThreadController = asyncHandler(
  async (req: Request<ThreadIdParam>, res: Response) => {
    const userId = res.locals.userId as string;
    const { threadId } = req.params;

    // Verify participant
    const participation = await db
      .selectFrom("messaging.thread_participants")
      .select("user_id")
      .where("thread_id", "=", threadId)
      .where("user_id", "=", userId)
      .executeTakeFirst();

    if (!participation) throw new AppError(403, "You are not a participant of this thread");

    const thread = await db
      .selectFrom("messaging.threads")
      .select(["id", "subject", "created_by", "created_at", "updated_at"])
      .where("id", "=", threadId)
      .executeTakeFirst();

    if (!thread) throw new AppError(404, "Thread not found");

    const participants = await db
      .selectFrom("messaging.thread_participants as tp")
      .innerJoin("messaging.users as u", "u.id", "tp.user_id")
      .select(["u.id", "u.email", "u.username", "u.image_url"])
      .where("tp.thread_id", "=", threadId)
      .execute();

    const creator = participants.find((p) => p.id === thread.created_by);

    res.json({
      id:          thread.id,
      subject:     thread.subject,
      createdAt:   thread.created_at,
      updatedAt:   thread.updated_at,
      createdBy:   creator ? mapUser(creator) : { id: thread.created_by },
      participants: participants.map(mapUser),
    });
  }
);

