import { Router } from "express";
import {
  editMessage,
  listMessages,
  unsendMessage
} from "../controllers/message.controller";
import { authenticate, requireBirthDate } from "../middleware/authenticate";
import {
  validateBody,
  validateParams,
  validateQuery
} from "../middleware/validateRequest";
import { asyncHandler } from "../utils/asyncHandler";
import {
  editMessageSchema,
  messageHistoryParamsSchema,
  messageHistoryQuerySchema,
  messageIdParamsSchema
} from "../validation/message.validation";

export const messageRouter = Router();

messageRouter.use(asyncHandler(authenticate));
messageRouter.use(requireBirthDate);
messageRouter.get(
  "/connections/:connectionId",
  validateParams(messageHistoryParamsSchema),
  validateQuery(messageHistoryQuerySchema),
  asyncHandler(listMessages)
);
messageRouter.delete(
  "/:messageId",
  validateParams(messageIdParamsSchema),
  asyncHandler(unsendMessage)
);
messageRouter.patch(
  "/:messageId",
  validateParams(messageIdParamsSchema),
  validateBody(editMessageSchema),
  asyncHandler(editMessage)
);
