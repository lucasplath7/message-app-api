import type { Request, Response } from "express";
import { db } from "../../config/db.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { AppError } from "../../utils/appError.js";
import { isUserOnline, getOnlineUsers } from "../../config/redis.js";
import type { SyncUserBody } from "../../schemas/user/user.schemas.js";

// ── POST /api/users/sync ─────────────────────────────────────────
// Called by the UI after every Clerk login to keep the DB in sync.
export const syncUserController = asyncHandler(
  async (req: Request<{}, {}, SyncUserBody>, res: Response) => {
    const userId = res.locals.userId as string;
    const { email, username, imageUrl } = req.body;

    const user = await db
      .insertInto("messaging.users")
      .values({
        id:        userId,
        email,
        username,
        image_url: imageUrl ?? null,
      })
      .onConflict((oc) =>
        oc.column("id").doUpdateSet({
          email,
          username,
          image_url: imageUrl ?? null,
        })
      )
      .returning(["id", "email", "username", "image_url"])
      .executeTakeFirstOrThrow();

    res.status(200).json({
      id:       user.id,
      email:    user.email,
      username: user.username,
      imageUrl: user.image_url,
    });
  }
);

// ── GET /api/users ───────────────────────────────────────────────
// Returns all users with their current online status.
export const listUsersController = asyncHandler(
  async (_req: Request, res: Response) => {
    const users = await db
      .selectFrom("messaging.users")
      .select(["id", "email", "username", "image_url"])
      .orderBy("username asc")
      .execute();

    const onlineIds = new Set(await getOnlineUsers());

    const result = users.map((u) => ({
      id:       u.id,
      email:    u.email,
      username: u.username,
      imageUrl: u.image_url,
      online:   onlineIds.has(u.id),
    }));

    res.json(result);
  }
);

// ── GET /api/users/:userId ───────────────────────────────────────
export const getUserController = asyncHandler(
  async (req: Request<{ userId: string }>, res: Response) => {
    const { userId } = req.params;

    const user = await db
      .selectFrom("messaging.users")
      .select(["id", "email", "username", "image_url"])
      .where("id", "=", userId)
      .executeTakeFirst();

    if (!user) throw new AppError(404, "User not found");

    res.json({
      id:       user.id,
      email:    user.email,
      username: user.username,
      imageUrl: user.image_url,
      online:   await isUserOnline(user.id),
    });
  }
);
