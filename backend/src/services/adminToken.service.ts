import { randomBytes } from "crypto";
import jwt, { type JwtPayload } from "jsonwebtoken";
import { env } from "../config/env";
import {
  ADMIN_EMAIL,
  ADMIN_SESSION_TTL_SECONDS
} from "../constants/admin";
import { AUTH_TOKEN_ISSUER } from "../constants/auth";
import { AppError } from "../utils/errors";

const ADMIN_AUDIENCE = "bondera-admin";

interface AdminTokenPayload extends JwtPayload {
  type: "admin_session";
  email: string;
  csrf: string;
}

export const createAdminSession = (): { token: string; csrfToken: string } => {
  const csrfToken = randomBytes(32).toString("hex");
  const token = jwt.sign(
    {
      type: "admin_session",
      email: ADMIN_EMAIL,
      csrf: csrfToken
    },
    env.JWT_ACCESS_SECRET,
    {
      issuer: AUTH_TOKEN_ISSUER,
      audience: ADMIN_AUDIENCE,
      subject: "super-admin",
      expiresIn: ADMIN_SESSION_TTL_SECONDS
    }
  );

  return { token, csrfToken };
};

export const verifyAdminSession = (token: string): AdminTokenPayload => {
  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET, {
      issuer: AUTH_TOKEN_ISSUER,
      audience: ADMIN_AUDIENCE
    });

    if (
      typeof payload === "string" ||
      payload.type !== "admin_session" ||
      payload.email !== ADMIN_EMAIL ||
      typeof payload.csrf !== "string"
    ) {
      throw new Error("Unexpected admin token payload.");
    }

    return payload as AdminTokenPayload;
  } catch {
    throw new AppError(401, "ADMIN_SESSION_INVALID", "Admin session is invalid or expired.");
  }
};
