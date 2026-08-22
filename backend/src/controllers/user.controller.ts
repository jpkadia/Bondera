import type { Response } from "express";
import { UserModel } from "../models/User";
import { issueOtp, verifyAndConsumeOtp } from "../services/otp.service";
import type { AuthenticatedRequest } from "../types/http";
import { AppError } from "../utils/errors";
import type {
  RequestEmailChangeOtpInput,
  UpdateProfileInput,
  VerifyEmailChangeInput
} from "../validation/user.validation";

const isDuplicateKeyError = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  (error as { code?: number }).code === 11000;

const requireUser = async (req: AuthenticatedRequest) => {
  const user = await UserModel.findById(req.user!.mongoId);

  if (!user || user.status !== "active") {
    throw new AppError(404, "USER_NOT_AVAILABLE", "Your account is unavailable.");
  }

  return user;
};

export const getMyProfile = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  const user = await requireUser(req);
  res.status(200).json({ success: true, data: { user: user.toJSON() } });
};

export const updateMyProfile = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  const input = req.body as UpdateProfileInput;
  const user = await requireUser(req);

  if (input.username && input.username !== user.username) {
    const unavailable = await UserModel.exists({
      username: input.username,
      _id: { $ne: user._id }
    });

    if (unavailable) {
      throw new AppError(409, "USERNAME_UNAVAILABLE", "This username is not available.");
    }

    user.username = input.username;
  }

  if (input.fullName !== undefined) {
    user.fullName = input.fullName || undefined;
  }

  try {
    await user.save();
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new AppError(409, "USERNAME_UNAVAILABLE", "This username is not available.");
    }
    throw error;
  }

  res.status(200).json({ success: true, data: { user: user.toJSON() } });
};

export const requestEmailChangeOtp = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  const input = req.body as RequestEmailChangeOtpInput;
  const user = await requireUser(req);

  if (input.email === user.email) {
    throw new AppError(409, "EMAIL_UNCHANGED", "This is already your account email.");
  }

  if (await UserModel.exists({ email: input.email, _id: { $ne: user._id } })) {
    throw new AppError(409, "EMAIL_ALREADY_REGISTERED", "This email is already registered.");
  }

  const result = await issueOtp({
    email: input.email,
    purpose: "email_change",
    targetUser: req.user!.mongoId,
    ipAddress: req.ip,
    userAgent: req.get("user-agent")
  });

  res.status(202).json({
    success: true,
    message: "A verification OTP has been sent to your new email.",
    data: {
      expiresAt: result.expiresAt,
      retryAfterSeconds: result.retryAfterSeconds
    }
  });
};

export const verifyEmailChange = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  const input = req.body as VerifyEmailChangeInput;
  const user = await requireUser(req);

  if (input.email === user.email) {
    throw new AppError(409, "EMAIL_UNCHANGED", "This is already your account email.");
  }

  if (await UserModel.exists({ email: input.email, _id: { $ne: user._id } })) {
    throw new AppError(409, "EMAIL_ALREADY_REGISTERED", "This email is already registered.");
  }

  await verifyAndConsumeOtp(
    input.email,
    "email_change",
    input.otp,
    req.user!.mongoId
  );

  user.email = input.email;
  user.isEmailVerified = true;

  try {
    await user.save();
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new AppError(409, "EMAIL_ALREADY_REGISTERED", "This email is already registered.");
    }
    throw error;
  }

  res.status(200).json({ success: true, data: { user: user.toJSON() } });
};
