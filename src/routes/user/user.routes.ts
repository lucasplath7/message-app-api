import { Router } from "express";
import { requireAuth } from "../../middleware/requireAuth.js";
import { validate } from "../../middleware/validate.js";
import { syncUserSchema } from "../../schemas/user/user.schemas.js";
import { syncUserController, listUsersController } from "../../controllers/user/user.controller.js";

export const userRouter = Router();

// POST /api/users/sync — upsert Clerk user into DB; call after every login
userRouter.post("/sync", requireAuth, validate({ body: syncUserSchema }), syncUserController);

// GET /api/users — list all users with online status
userRouter.get("/", requireAuth, listUsersController);


