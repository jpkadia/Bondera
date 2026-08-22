import jwt, { type JwtPayload, type SignOptions } from "jsonwebtoken";
import { env } from "../config/env";
import { AUTH_TOKEN_AUDIENCE, AUTH_TOKEN_ISSUER } from "../constants/auth";
import type { UserDocument } from "../models/User";
import { AppError } from "../utils/errors";

export interface AuthTokenPayload extends JwtPayload {
  type: "access" | "refresh";
}

const commonSignOptions = {
  issuer: AUTH_TOKEN_ISSUER,
  audience: AUTH_TOKEN_AUDIENCE
} satisfies Pick<SignOptions, "issuer" | "audience">;

const signToken = (
  user: UserDocument,
  type: AuthTokenPayload["type"],
  secret: string,
  expiresIn: SignOptions["expiresIn"]
): string => {
  return jwt.sign(
    { type },
    secret,
    {
      ...commonSignOptions,
      subject: user._id.toString(),
      expiresIn
    }
  );
};

export const createAuthTokens = (user: UserDocument) => ({
  accessToken: signToken(
    user,
    "access",
    env.JWT_ACCESS_SECRET,
    env.JWT_ACCESS_EXPIRES_IN as SignOptions["expiresIn"]
  ),
  refreshToken: signToken(
    user,
    "refresh",
    env.JWT_REFRESH_SECRET,
    env.JWT_REFRESH_EXPIRES_IN as SignOptions["expiresIn"]
  )
});

const verifyToken = (
  token: string,
  secret: string,
  expectedType: AuthTokenPayload["type"]
): AuthTokenPayload => {
  try {
    const payload = jwt.verify(token, secret, {
      issuer: AUTH_TOKEN_ISSUER,
      audience: AUTH_TOKEN_AUDIENCE
    });

    if (
      typeof payload === "string" ||
      payload.type !== expectedType ||
      typeof payload.sub !== "string"
    ) {
      throw new Error("Unexpected token payload.");
    }

    return payload as AuthTokenPayload;
  } catch {
    throw new AppError(401, "TOKEN_INVALID", "The authentication token is invalid or expired.");
  }
};

export const verifyAccessToken = (token: string): AuthTokenPayload =>
  verifyToken(token, env.JWT_ACCESS_SECRET, "access");

export const verifyRefreshToken = (token: string): AuthTokenPayload =>
  verifyToken(token, env.JWT_REFRESH_SECRET, "refresh");
