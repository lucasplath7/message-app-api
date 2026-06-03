import type { Request, Response } from "express";
import { db } from "../../config/db.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { AppError } from "../../utils/appError.js";
import { publish, CHANNELS } from "../../config/redis.js";
import type { CreateMessageBody, GetMessagesQuery } from "../../schemas/message/message.schemas.js";
import type { ThreadIdParam } from "../../schemas/thread/thread.schemas.js";

// ── POST /api/threads/:threadId/messages ─────────────────────────
export const createMessageController = asyncHandler(
  async (req: Request<ThreadIdParam, {}, CreateMessageBody>, res: Response) => {
    const userId = res.locals.userId as string;
    const { threadId } = req.params;
    const { body } = req.body;

    // Verify the sender is a participant
    const participation = await db
      .selectFrom("messaging.thread_participants")
      .select("user_id")
      .where("thread_id", "=", threadId)
      .where("user_id", "=", userId)
      .executeTakeFirst();

    if (!participation) throw new AppError(403, "You are not a participant of this thread");

    // Insert message and bump thread updated_at in a transaction
    const [message, sender] = await db.transaction().execute(async (trx) => {
      const msg = await trx
        .insertInto("messaging.messages")
        .values({ thread_id: threadId, sender_id: userId, body })
        .returning(["id", "thread_id", "sender_id", "body", "created_at", "updated_at"])
        .executeTakeFirstOrThrow();

      // Bump thread.updated_at so the list stays sorted correctly
      await trx
        .updateTable("messaging.threads")
        .set({ updated_at: new Date() as any })
        .where("id", "=", threadId)
        .execute();

      const user = await trx
        .selectFrom("messaging.users")
        .select(["id", "email", "username", "image_url"])
        .where("id", "=", userId)
        .executeTakeFirstOrThrow();

      return [msg, user] as const;
    });

    const messageResponse = {
      id:        message.id,
      threadId:  message.thread_id,
      body:      message.body,
      createdAt: message.created_at,
      updatedAt: message.updated_at,
      sender: {
        id:       sender.id,
        email:    sender.email,
        username: sender.username,
        imageUrl: sender.image_url,
      },
    };

    // Broadcast via Redis → socket server
    await publish(CHANNELS.MESSAGE_NEW, {
      threadId,
      message: messageResponse,
    });

    res.status(201).json(messageResponse);
  }
);

// ── GET /api/threads/:threadId/messages ──────────────────────────
export const getMessagesController = asyncHandler(
  async (req: Request<ThreadIdParam>, res: Response) => {
    const userId = res.locals.userId as string;
    const { threadId } = req.params;
    const { limit, before } = req.query as unknown as GetMessagesQuery;

    // Verify participation
    const participation = await db
      .selectFrom("messaging.thread_participants")
      .select("user_id")
      .where("thread_id", "=", threadId)
      .where("user_id", "=", userId)
      .executeTakeFirst();

    if (!participation) throw new AppError(403, "You are not a participant of this thread");

    let query = db
      .selectFrom("messaging.messages as m")
      .innerJoin("messaging.users as u", "u.id", "m.sender_id")
      .select([
        "m.id",
        "m.thread_id",
        "m.body",
        "m.created_at",
        "m.updated_at",
        "u.id as user_id",
        "u.email",
        "u.username",
        "u.image_url",
      ])
      .where("m.thread_id", "=", threadId)
      .orderBy("m.created_at", "asc")
      .limit(limit ?? 50);

    // Cursor-based pagination: get messages before this timestamp
    if (before) {
      query = query.where("m.created_at", "<", new Date(before) as any);
    }

    const rows = await query.execute();

    const messages = rows.map((row) => ({
      id:        row.id,
      threadId:  row.thread_id,
      body:      row.body,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      sender: {
        id:       row.user_id,
        email:    row.email,
        username: row.username,
        imageUrl: row.image_url,
      },
    }));

    res.json(messages);
  }
);


