import { Router } from "express";
import rateLimit from "express-rate-limit";
import {
  askPrivateAi,
  deleteAiConversation,
  listAiConversations
} from "../controllers/ai.controller";
import { authenticate, requireBirthDate } from "../middleware/authenticate";
import { requirePremium } from "../middleware/requirePremium";
import { validateBody, validateParams } from "../middleware/validateRequest";
import { asyncHandler } from "../utils/asyncHandler";
import {
  aiConversationParamsSchema,
  askPrivateAiSchema
} from "../validation/ai.validation";

export const aiRouter = Router();

const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    code: "AI_REQUEST_RATE_LIMITED",
    message: "Too many AI requests. Please try again later."
  }
});

aiRouter.use(asyncHandler(authenticate));
aiRouter.use(requireBirthDate);
aiRouter.use(requirePremium);
aiRouter.get("/conversations", asyncHandler(listAiConversations));
aiRouter.delete(
  "/conversations/:conversationId",
  validateParams(aiConversationParamsSchema),
  asyncHandler(deleteAiConversation)
);
aiRouter.post(
  "/chat",
  aiLimiter,
  validateBody(askPrivateAiSchema),
  asyncHandler(askPrivateAi)
);
