import { Router } from "express";
import rateLimit from "express-rate-limit";
import { askPrivateAi } from "../controllers/ai.controller";
import { authenticate } from "../middleware/authenticate";
import { requirePremium } from "../middleware/requirePremium";
import { validateBody } from "../middleware/validateRequest";
import { asyncHandler } from "../utils/asyncHandler";
import { askPrivateAiSchema } from "../validation/ai.validation";

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
aiRouter.use(requirePremium);
aiRouter.post(
  "/chat",
  aiLimiter,
  validateBody(askPrivateAiSchema),
  asyncHandler(askPrivateAi)
);
