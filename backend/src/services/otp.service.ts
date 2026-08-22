import { randomInt } from "crypto";
import bcrypt from "bcryptjs";
import type { Types } from "mongoose";
import { env } from "../config/env";
import {
  OTP_MAX_ATTEMPTS,
  OTP_RESEND_COOLDOWN_SECONDS,
  OTP_TTL_MINUTES
} from "../constants/auth";
import { OtpModel, type OtpPurpose } from "../models/Otp";
import { AppError } from "../utils/errors";
import { sendOtpEmail } from "./brevo.service";

interface OtpRequestMetadata {
  ipAddress?: string;
  userAgent?: string;
}

interface IssueOtpInput extends OtpRequestMetadata {
  email: string;
  purpose: OtpPurpose;
  targetUser?: Types.ObjectId;
}

export const issueOtp = async ({
  email,
  purpose,
  targetUser,
  ipAddress,
  userAgent
}: IssueOtpInput): Promise<{ expiresAt: Date; retryAfterSeconds: number }> => {
  const normalizedEmail = email.toLowerCase();
  const latestOtp = await OtpModel.findOne({
    email: normalizedEmail,
    purpose,
    consumedAt: null,
    ...(targetUser ? { targetUser } : {})
  })
    .sort({ createdAt: -1 })
    .select("createdAt")
    .lean();

  if (latestOtp?.createdAt) {
    const elapsedSeconds = Math.floor(
      (Date.now() - latestOtp.createdAt.getTime()) / 1000
    );

    if (elapsedSeconds < OTP_RESEND_COOLDOWN_SECONDS) {
      throw new AppError(
        429,
        "OTP_RESEND_TOO_SOON",
        "Please wait before requesting another OTP.",
        { retryAfterSeconds: OTP_RESEND_COOLDOWN_SECONDS - elapsedSeconds }
      );
    }
  }

  const otp = randomInt(100000, 1000000).toString();
  const otpHash = await bcrypt.hash(otp, env.BCRYPT_SALT_ROUNDS);
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

  await OtpModel.updateMany(
    {
      email: normalizedEmail,
      purpose,
      consumedAt: null,
      ...(targetUser ? { targetUser } : {})
    },
    { $set: { consumedAt: new Date() } }
  );

  const otpRecord = await OtpModel.create({
    email: normalizedEmail,
    otpHash,
    purpose,
    attempts: 0,
    maxAttempts: OTP_MAX_ATTEMPTS,
    expiresAt,
    targetUser,
    ipAddress,
    userAgent
  });

  try {
    await sendOtpEmail({
      email: normalizedEmail,
      otp,
      expiresInMinutes: OTP_TTL_MINUTES,
      purpose
    });
  } catch (error) {
    await OtpModel.deleteOne({ _id: otpRecord._id });
    throw error;
  }

  return { expiresAt, retryAfterSeconds: OTP_RESEND_COOLDOWN_SECONDS };
};

export const verifyAndConsumeOtp = async (
  email: string,
  purpose: OtpPurpose,
  otp: string,
  targetUser?: Types.ObjectId
): Promise<void> => {
  const normalizedEmail = email.toLowerCase();
  const otpRecord = await OtpModel.findOne({
    email: normalizedEmail,
    purpose,
    consumedAt: null,
    ...(targetUser ? { targetUser } : {})
  })
    .sort({ createdAt: -1 })
    .select("+otpHash");

  if (!otpRecord) {
    throw new AppError(400, "OTP_INVALID", "The OTP is invalid or no longer active.");
  }

  if (otpRecord.expiresAt.getTime() <= Date.now()) {
    throw new AppError(400, "OTP_EXPIRED", "The OTP has expired. Request a new one.");
  }

  if (otpRecord.attempts >= otpRecord.maxAttempts) {
    throw new AppError(429, "OTP_ATTEMPTS_EXCEEDED", "Too many invalid OTP attempts.");
  }

  const isMatch = await bcrypt.compare(otp, otpRecord.otpHash);

  if (!isMatch) {
    const nextAttempts = otpRecord.attempts + 1;
    await OtpModel.updateOne(
      { _id: otpRecord._id, consumedAt: null },
      {
        $inc: { attempts: 1 },
        ...(nextAttempts >= otpRecord.maxAttempts
          ? { $set: { consumedAt: new Date() } }
          : {})
      }
    );
    throw new AppError(400, "OTP_INVALID", "The OTP is invalid.", {
      attemptsRemaining: Math.max(otpRecord.maxAttempts - nextAttempts, 0)
    });
  }

  const consumed = await OtpModel.findOneAndUpdate(
    {
      _id: otpRecord._id,
      consumedAt: null,
      expiresAt: { $gt: new Date() },
      attempts: { $lt: otpRecord.maxAttempts }
    },
    { $set: { consumedAt: new Date() } },
    { new: true }
  );

  if (!consumed) {
    throw new AppError(409, "OTP_ALREADY_USED", "The OTP has already been used.");
  }
};
