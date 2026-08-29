import type { Types } from "mongoose";
import { PasswordResetSessionModel } from "../models/PasswordResetSession";
import { AppError } from "../utils/errors";
import {
  createPasswordResetToken,
  hashPasswordResetToken
} from "../utils/passwordResetToken";

const RESET_SESSION_TTL_MINUTES = 10;

interface CreatePasswordResetSessionInput {
  userId: Types.ObjectId;
  ipAddress?: string;
  userAgent?: string;
}

export const createPasswordResetSession = async ({
  userId,
  ipAddress,
  userAgent
}: CreatePasswordResetSessionInput): Promise<{
  resetToken: string;
  expiresAt: Date;
}> => {
  const resetToken = createPasswordResetToken();
  const expiresAt = new Date(
    Date.now() + RESET_SESSION_TTL_MINUTES * 60 * 1000
  );

  await PasswordResetSessionModel.updateMany(
    { user: userId, consumedAt: null },
    { $set: { consumedAt: new Date() } }
  );
  await PasswordResetSessionModel.create({
    user: userId,
    tokenHash: hashPasswordResetToken(resetToken),
    expiresAt,
    ipAddress,
    userAgent
  });

  return { resetToken, expiresAt };
};

export const consumePasswordResetSession = async (
  resetToken: string
): Promise<Types.ObjectId> => {
  const session = await PasswordResetSessionModel.findOneAndUpdate(
    {
      tokenHash: hashPasswordResetToken(resetToken),
      consumedAt: null,
      expiresAt: { $gt: new Date() }
    },
    { $set: { consumedAt: new Date() } },
    { new: true }
  ).select("+tokenHash user");

  if (!session) {
    throw new AppError(
      400,
      "PASSWORD_RESET_SESSION_INVALID",
      "This password reset session is invalid or expired. Start again."
    );
  }

  return session.user as unknown as Types.ObjectId;
};
