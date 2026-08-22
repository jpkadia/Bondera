import { Router } from "express";
import { aiRouter } from "./ai.routes";
import { adminRouter } from "./admin.routes";
import { authRouter } from "./auth.routes";
import { connectionRouter } from "./connection.routes";
import { mediaRouter } from "./media.routes";
import { messageRouter } from "./message.routes";
import { userRouter } from "./user.routes";

export const apiRouter = Router();

apiRouter.use("/ai", aiRouter);
apiRouter.use("/admin", adminRouter);
apiRouter.use("/auth", authRouter);
apiRouter.use("/connections", connectionRouter);
apiRouter.use("/messages", messageRouter);
apiRouter.use("/media", mediaRouter);
apiRouter.use("/users", userRouter);
