import type { Response } from "express";
import { UserModel } from "../models/User";
import { DeviceInstallationModel } from "../models/DeviceInstallation";
import { PremiumRequestModel } from "../models/PremiumRequest";
import { MAX_PREMIUM_USERS } from "../constants/admin";
import { issueOtp, verifyAndConsumeOtp } from "../services/otp.service";
import { migrateStoredGoogleProfilePicture } from "../services/googleProfilePicture.service";
import type { AuthenticatedRequest } from "../types/http";
import { AppError } from "../utils/errors";
import type {
  RequestEmailChangeOtpInput,
  DeviceContextInput,
  UnregisterDeviceInput,
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
  await migrateStoredGoogleProfilePicture(user).catch(() => false);
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

  if (input.birthDate !== undefined) {
    user.birthDate = input.birthDate;
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

export const syncDeviceContext = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  const input = req.body as DeviceContextInput;
  const user = await requireUser(req);

  if (user.timeZone !== input.timeZone) {
    user.timeZone = input.timeZone;
    await user.save();
  }

  if (input.expoPushToken && input.platform) {
    await DeviceInstallationModel.findOneAndUpdate(
      { expoPushToken: input.expoPushToken },
      {
        $set: {
          user: user._id,
          platform: input.platform,
          timeZone: input.timeZone,
          active: true,
          lastSeenAt: new Date()
        },
        $unset: { invalidatedAt: 1 }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }

  res.status(200).json({ success: true, data: { user: user.toJSON() } });
};

export const unregisterDevice = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  const input = req.body as UnregisterDeviceInput;
  await DeviceInstallationModel.updateOne(
    { user: req.user!.mongoId, expoPushToken: input.expoPushToken },
    {
      $set: { active: false, invalidatedAt: new Date() }
    }
  );
  res.status(204).send();
};

const premiumRequestView = (request?: {
  status: string;
  requestedAt: Date;
  decidedAt?: Date;
  adminNote?: string;
} | null) => request
  ? {
      status: request.status,
      requestedAt: request.requestedAt,
      decidedAt: request.decidedAt,
      adminNote: request.adminNote
    }
  : null;

export const getMyPremiumRequest = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  const [user, request, premiumCount] = await Promise.all([
    requireUser(req),
    PremiumRequestModel.findOne({ user: req.user!.mongoId }).lean(),
    UserModel.countDocuments({ isPremium: true })
  ]);

  res.status(200).json({
    success: true,
    data: {
      isPremium: user.isPremium,
      request: premiumRequestView(request),
      premiumCount,
      premiumLimit: MAX_PREMIUM_USERS
    }
  });
};

export const requestPremiumAccess = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  const user = await requireUser(req);

  if (user.isPremium) {
    throw new AppError(409, "ALREADY_PREMIUM", "Your account already has premium access.");
  }

  const existing = await PremiumRequestModel.findOne({ user: user._id });
  if (existing?.status === "pending") {
    res.status(200).json({
      success: true,
      data: { request: premiumRequestView(existing) }
    });
    return;
  }

  const request = await PremiumRequestModel.findOneAndUpdate(
    { user: user._id },
    {
      $set: {
        status: "pending",
        requestedAt: new Date()
      },
      $unset: {
        decidedAt: 1,
        decidedBy: 1,
        adminNote: 1
      }
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  res.status(202).json({
    success: true,
    message: "Your premium request has been sent to the admin.",
    data: { request: premiumRequestView(request) }
  });
};
