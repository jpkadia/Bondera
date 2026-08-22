import type { NextFunction, Response } from "express";
import type { AuthenticatedRequest } from "../types/http";
import { AppError } from "../utils/errors";

export const requirePremium = (
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    next(new AppError(401, "AUTH_REQUIRED", "Authentication is required."));
    return;
  }

  if (!req.user.isPremium) {
    next(
      new AppError(
        403,
        "PREMIUM_REQUIRED",
        "Bondera AI is available only to premium users."
      )
    );
    return;
  }

  next();
};
