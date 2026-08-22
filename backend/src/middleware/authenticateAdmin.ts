import { timingSafeEqual } from "crypto";
import type { NextFunction, Response } from "express";
import { ADMIN_SESSION_COOKIE } from "../constants/admin";
import { verifyAdminSession } from "../services/adminToken.service";
import type { AuthenticatedAdminRequest } from "../types/http";
import { readCookie } from "../utils/cookies";
import { AppError } from "../utils/errors";

const constantTimeEqual = (left: string, right: string): boolean => {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
};

export const authenticateAdmin = (
  req: AuthenticatedAdminRequest,
  _res: Response,
  next: NextFunction
): void => {
  try {
    const token = readCookie(req, ADMIN_SESSION_COOKIE);

    if (!token) {
      throw new AppError(401, "ADMIN_AUTH_REQUIRED", "Admin authentication is required.");
    }

    const payload = verifyAdminSession(token);
    req.admin = {
      email: payload.email,
      csrfToken: payload.csrf
    };
    next();
  } catch (error) {
    next(error);
  }
};

export const requireAdminCsrf = (
  req: AuthenticatedAdminRequest,
  _res: Response,
  next: NextFunction
): void => {
  const csrfHeader = req.header("x-csrf-token");

  if (
    !req.admin ||
    !csrfHeader ||
    !constantTimeEqual(csrfHeader, req.admin.csrfToken)
  ) {
    next(new AppError(403, "CSRF_INVALID", "Admin security token is invalid."));
    return;
  }

  next();
};
