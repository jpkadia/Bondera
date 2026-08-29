import { Router } from "express";
import rateLimit from "express-rate-limit";
import {
  authenticateGoogleToken,
  googleCallback,
  login,
  requestPasswordResetOtp,
  refreshSession,
  resetPassword,
  requestSignupOtp,
  startGoogleAuth,
  verifyPasswordResetOtp,
  verifySignup
} from "../controllers/auth.controller";
import { validateBody } from "../middleware/validateRequest";
import { asyncHandler } from "../utils/asyncHandler";
import {
  googleTokenSchema,
  loginSchema,
  requestPasswordResetOtpSchema,
  refreshTokenSchema,
  resetPasswordSchema,
  requestSignupOtpSchema,
  verifyPasswordResetOtpSchema,
  verifySignupSchema
} from "../validation/auth.validation";

export const authRouter = Router();

const otpRequestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    code: "OTP_RATE_LIMITED",
    message: "Too many OTP requests. Please try again later."
  }
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 15,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: {
    success: false,
    code: "LOGIN_RATE_LIMITED",
    message: "Too many sign-in attempts. Please try again later."
  }
});

authRouter.post(
  "/signup/request-otp",
  otpRequestLimiter,
  validateBody(requestSignupOtpSchema),
  asyncHandler(requestSignupOtp)
);
authRouter.post(
  "/signup/verify",
  loginLimiter,
  validateBody(verifySignupSchema),
  asyncHandler(verifySignup)
);
authRouter.post(
  "/login",
  loginLimiter,
  validateBody(loginSchema),
  asyncHandler(login)
);
authRouter.post(
  "/password/forgot/request-otp",
  otpRequestLimiter,
  validateBody(requestPasswordResetOtpSchema),
  asyncHandler(requestPasswordResetOtp)
);
authRouter.post(
  "/password/forgot/verify-otp",
  loginLimiter,
  validateBody(verifyPasswordResetOtpSchema),
  asyncHandler(verifyPasswordResetOtp)
);
authRouter.post(
  "/password/forgot/reset",
  loginLimiter,
  validateBody(resetPasswordSchema),
  asyncHandler(resetPassword)
);
authRouter.post(
  "/refresh",
  validateBody(refreshTokenSchema),
  asyncHandler(refreshSession)
);
authRouter.post(
  "/google/token",
  loginLimiter,
  validateBody(googleTokenSchema),
  asyncHandler(authenticateGoogleToken)
);
authRouter.get("/google", asyncHandler(startGoogleAuth));
authRouter.get("/google/callback", asyncHandler(googleCallback));
