import { Router } from "express";
import { healthRouter } from "./health/health.routes.js";
import { userRouter } from "./user/user.routes.js";
import { threadRouter } from "./thread/thread.routes.js";
import { messageRouter } from "./message/message.routes.js";

export const apiRouter = Router();

apiRouter.use("/health",                    healthRouter);
apiRouter.use("/users",                     userRouter);
apiRouter.use("/threads",                   threadRouter);
apiRouter.use("/threads/:threadId/messages", messageRouter);
