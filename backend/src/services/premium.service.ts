import mongoose, { Types } from "mongoose";
import { ADMIN_EMAIL, MAX_PREMIUM_USERS } from "../constants/admin";
import { AdminAuditLogModel } from "../models/AdminAuditLog";
import { PremiumRequestModel } from "../models/PremiumRequest";
import { SystemStateModel } from "../models/SystemState";
import { UserModel } from "../models/User";
import { AppError } from "../utils/errors";
import { hasPremiumCapacity } from "../utils/premiumCapacity";

export interface PremiumUpdateResult {
  user: {
    id: string;
    email: string;
    username: string;
    isPremium: boolean;
  };
  premiumCount: number;
  premiumLimit: number;
}

interface SetPremiumInput {
  userId: string | Types.ObjectId;
  isPremium: boolean;
  actorEmail: string;
  ipAddress?: string;
  userAgent?: string;
}

export const setPremiumStatus = async ({
  userId,
  isPremium,
  actorEmail,
  ipAddress,
  userAgent
}: SetPremiumInput): Promise<PremiumUpdateResult> => {
  const session = await mongoose.startSession();
  let resultUser: PremiumUpdateResult["user"] | undefined;

  try {
    await session.withTransaction(async () => {
      await SystemStateModel.findOneAndUpdate(
        { _id: "premium-limit" },
        { $inc: { revision: 1 } },
        { upsert: true, new: true, session, setDefaultsOnInsert: true }
      );

      const user = await UserModel.findById(userId).session(session);
      if (!user) {
        throw new AppError(404, "USER_NOT_FOUND", "User was not found.");
      }

      if (user.isPremium !== isPremium) {
        if (isPremium) {
          const premiumCount = await UserModel.countDocuments({
            isPremium: true
          }).session(session);

          if (!hasPremiumCapacity(premiumCount, MAX_PREMIUM_USERS)) {
            throw new AppError(
              409,
              "PREMIUM_LIMIT_REACHED",
              `A maximum of ${MAX_PREMIUM_USERS} users can be premium.`
            );
          }
        }

        user.isPremium = isPremium;
        await user.save({ session });
        await PremiumRequestModel.updateOne(
          { user: user._id },
          {
            $set: {
              status: isPremium ? "approved" : "revoked",
              decidedAt: new Date(),
              decidedBy: actorEmail
            }
          },
          { session }
        );
        await AdminAuditLogModel.create(
          [
            {
              actorEmail,
              action: isPremium ? "premium_granted" : "premium_revoked",
              targetUser: user._id,
              metadata: {
                username: user.username,
                uniqueId: user.uniqueId
              },
              ipAddress,
              userAgent
            }
          ],
          { session }
        );
      }

      resultUser = {
        id: user._id.toString(),
        email: user.email,
        username: user.username,
        isPremium: user.isPremium
      };
    });
  } finally {
    await session.endSession();
  }

  if (!resultUser) {
    throw new AppError(500, "PREMIUM_UPDATE_FAILED", "Premium status could not be updated.");
  }

  return {
    user: resultUser,
    premiumCount: await UserModel.countDocuments({ isPremium: true }),
    premiumLimit: MAX_PREMIUM_USERS
  };
};

export const ensurePremiumOwner = async (
  userId: string | Types.ObjectId,
  email: string
): Promise<boolean> => {
  if (email.toLowerCase() !== ADMIN_EMAIL) return false;

  try {
    await setPremiumStatus({
      userId,
      isPremium: true,
      actorEmail: ADMIN_EMAIL
    });
    return true;
  } catch (error) {
    if (error instanceof AppError && error.code === "PREMIUM_LIMIT_REACHED") {
      return false;
    }
    throw error;
  }
};

export const rejectPremiumRequest = async (
  requestId: string | Types.ObjectId,
  actorEmail: string,
  adminNote?: string,
  ipAddress?: string,
  userAgent?: string
): Promise<void> => {
  const request = await PremiumRequestModel.findOneAndUpdate(
    { _id: requestId, status: "pending" },
    {
      $set: {
        status: "rejected",
        decidedAt: new Date(),
        decidedBy: actorEmail,
        adminNote: adminNote || undefined
      }
    },
    { new: true }
  );

  if (!request) {
    throw new AppError(
      409,
      "PREMIUM_REQUEST_NOT_PENDING",
      "This premium request is no longer pending."
    );
  }

  await AdminAuditLogModel.create({
    actorEmail,
    action: "premium_request_rejected",
    targetUser: request.user,
    metadata: adminNote ? { adminNote } : undefined,
    ipAddress,
    userAgent
  });
};
