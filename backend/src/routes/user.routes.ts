import { Router } from "express";
import rateLimit from "express-rate-limit";
import {
  getMyProfile,
  requestEmailChangeOtp,
  updateMyProfile,
  verifyEmailChange
} from "../controllers/user.controller";
import { authenticate } from "../middleware/authenticate";
import { validateBody } from "../middleware/validateRequest";
import { asyncHandler } from "../utils/asyncHandler";
import {
  requestEmailChangeOtpSchema,
  updateProfileSchema,
  verifyEmailChangeSchema
} from "../validation/user.validation";

export const userRouter = Router();

const emailChangeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    code: "EMAIL_CHANGE_RATE_LIMITED",
    message: "Too many email verification requests. Please try again later."
  }
});

userRouter.use(authenticate);
userRouter.get("/me", asyncHandler(getMyProfile));
userRouter.patch(
  "/me/profile",
  validateBody(updateProfileSchema),
  asyncHandler(updateMyProfile)
);
userRouter.post(
  "/me/email/request-otp",
  emailChangeLimiter,
  validateBody(requestEmailChangeOtpSchema),
  asyncHandler(requestEmailChangeOtp)
);
userRouter.post(
  "/me/email/verify",
  emailChangeLimiter,
  validateBody(verifyEmailChangeSchema),
  asyncHandler(verifyEmailChange)
);
