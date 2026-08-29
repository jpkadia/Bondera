import { Router } from "express";
import rateLimit from "express-rate-limit";
import {
  acceptConnectionRequest,
  listConnectionRequests,
  listContacts,
  rejectConnectionRequest,
  removeConnection,
  sendConnectionRequest,
  setConnectionCategory
} from "../controllers/connection.controller";
import { authenticate, requireBirthDate } from "../middleware/authenticate";
import { validateBody, validateParams } from "../middleware/validateRequest";
import { asyncHandler } from "../utils/asyncHandler";
import {
  connectionCategorySchema,
  connectionIdParamsSchema,
  sendConnectionRequestSchema
} from "../validation/connection.validation";

export const connectionRouter = Router();

const requestLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    code: "CONNECTION_REQUEST_RATE_LIMITED",
    message: "Too many connection requests. Please try again later."
  }
});

connectionRouter.use(asyncHandler(authenticate));
connectionRouter.use(requireBirthDate);

connectionRouter.get("/", asyncHandler(listContacts));
connectionRouter.get("/requests", asyncHandler(listConnectionRequests));
connectionRouter.post(
  "/requests",
  requestLimiter,
  validateBody(sendConnectionRequestSchema),
  asyncHandler(sendConnectionRequest)
);
connectionRouter.post(
  "/:connectionId/accept",
  validateParams(connectionIdParamsSchema),
  validateBody(connectionCategorySchema),
  asyncHandler(acceptConnectionRequest)
);
connectionRouter.post(
  "/:connectionId/reject",
  validateParams(connectionIdParamsSchema),
  asyncHandler(rejectConnectionRequest)
);
connectionRouter.patch(
  "/:connectionId/category",
  validateParams(connectionIdParamsSchema),
  validateBody(connectionCategorySchema),
  asyncHandler(setConnectionCategory)
);
connectionRouter.delete(
  "/:connectionId",
  validateParams(connectionIdParamsSchema),
  asyncHandler(removeConnection)
);
