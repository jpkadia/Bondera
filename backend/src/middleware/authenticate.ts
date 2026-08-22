import type { NextFunction, Response } from "express";
import { Types } from "mongoose";
import { UserModel } from "../models/User";
import type { AuthenticatedRequest } from "../types/http";
import { AppError } from "../utils/errors";
import { verifyAccessToken } from "../services/token.service";

export const authenticate = async (
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authorization = req.header("authorization");

    if (!authorization?.startsWith("Bearer ")) {
      throw new AppError(401, "AUTH_REQUIRED", "Authentication is required.");
    }

    const payload = verifyAccessToken(authorization.slice(7).trim());
    const user = await UserModel.findOne({ _id: payload.sub, status: "active" });

    if (!user) {
      throw new AppError(401, "USER_NOT_AVAILABLE", "The authenticated user is unavailable.");
    }

    req.user = {
      id: user._id.toString(),
      mongoId: new Types.ObjectId(user._id),
      email: user.email,
      username: user.username,
      uniqueId: user.uniqueId,
      isPremium: user.isPremium
    };
    next();
  } catch (error) {
    next(error);
  }
};
