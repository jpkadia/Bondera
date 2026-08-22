import { randomInt, timingSafeEqual } from "crypto";
import bcrypt from "bcryptjs";
import type { Request, Response } from "express";
import { env } from "../config/env";
import { PREMIUM_OWNER_EMAIL } from "../constants/auth";
import { UserModel, type UserDocument } from "../models/User";
import {
  createGoogleAuthorizationUrl,
  exchangeGoogleCode,
  verifyGoogleIdToken,
  verifyGoogleState
} from "../services/googleOAuth.service";
import { issueOtp, verifyAndConsumeOtp } from "../services/otp.service";
import { createAuthTokens, verifyRefreshToken } from "../services/token.service";
import { AppError } from "../utils/errors";
import type {
  LoginInput,
  GoogleTokenInput,
  RefreshTokenInput,
  RequestSignupOtpInput,
  VerifySignupInput
} from "../validation/auth.validation";

const GOOGLE_STATE_COOKIE = "bondera_google_state";
const GOOGLE_STATE_MAX_AGE_MS = 10 * 60 * 1000;

const isDuplicateKeyError = (error: unknown): boolean => {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: number }).code === 11000
  );
};

const readCookie = (req: Request, name: string): string | undefined => {
  const cookieHeader = req.headers.cookie;

  if (!cookieHeader) {
    return undefined;
  }

  for (const cookie of cookieHeader.split(";")) {
    const separatorIndex = cookie.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    const cookieName = cookie.slice(0, separatorIndex).trim();

    if (cookieName === name) {
      return decodeURIComponent(cookie.slice(separatorIndex + 1).trim());
    }
  }

  return undefined;
};

const constantTimeEqual = (left: string, right: string): boolean => {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
};

const ensureRegistrationAvailable = async (
  email: string,
  username: string
): Promise<void> => {
  const existing = await UserModel.findOne({
    $or: [{ email }, { username }]
  })
    .select("email username")
    .lean();

  if (!existing) {
    return;
  }

  if (existing.email === email) {
    throw new AppError(409, "EMAIL_ALREADY_REGISTERED", "This email is already registered.");
  }

  throw new AppError(409, "USERNAME_UNAVAILABLE", "This username is not available.");
};

const respondWithSession = (res: Response, user: UserDocument, statusCode = 200): void => {
  res.status(statusCode).json({
    success: true,
    data: {
      user: user.toJSON(),
      tokens: {
        tokenType: "Bearer",
        ...createAuthTokens(user)
      }
    }
  });
};

const buildUniqueGoogleUsername = async (email: string): Promise<string> => {
  let base = (email.split("@")[0] ?? "user")
    .toLowerCase()
    .replace(/[^a-z0-9._]/g, "")
    .replace(/\.{2,}/g, ".")
    .replace(/^[._]+|[._]+$/g, "")
    .slice(0, 30)
    .replace(/[._]+$/g, "");

  if (base.length < 3) {
    base = `user${base}`.slice(0, 30);
  }

  for (let attempt = 0; attempt < 25; attempt += 1) {
    const suffix = attempt === 0 ? "" : randomInt(1000, 100000000).toString();
    const prefix = base.slice(0, 30 - suffix.length).replace(/[._]+$/g, "");
    const candidate = `${prefix}${suffix}`;
    const exists = await UserModel.exists({ username: candidate });

    if (!exists) {
      return candidate;
    }
  }

  throw new AppError(503, "USERNAME_GENERATION_FAILED", "A username could not be generated.");
};

type GoogleProfile = Awaited<ReturnType<typeof verifyGoogleIdToken>>;

const provisionGoogleUser = async (profile: GoogleProfile): Promise<UserDocument> => {
  const email = profile.email!.toLowerCase();
  const [userByGoogleId, userByEmail] = await Promise.all([
    UserModel.findOne({ googleId: profile.sub }).select("+googleId"),
    UserModel.findOne({ email }).select("+googleId")
  ]);

  if (
    userByGoogleId &&
    userByEmail &&
    userByGoogleId._id.toString() !== userByEmail._id.toString()
  ) {
    throw new AppError(409, "GOOGLE_ACCOUNT_CONFLICT", "Google account linkage is inconsistent.");
  }

  const existingUser = userByGoogleId ?? userByEmail;

  if (existingUser) {
    if (existingUser.status !== "active") {
      throw new AppError(403, "ACCOUNT_UNAVAILABLE", "This account is not active.");
    }

    if (existingUser.googleId && existingUser.googleId !== profile.sub) {
      throw new AppError(409, "GOOGLE_ACCOUNT_CONFLICT", "This email uses another Google account.");
    }

    existingUser.googleId = profile.sub;
    existingUser.isEmailVerified = true;

    if (!existingUser.authProviders.includes("google")) {
      existingUser.authProviders.push("google");
    }

    if (!existingUser.fullName && profile.name) {
      existingUser.fullName = profile.name;
    }

    if (!existingUser.profilePicture?.url && profile.picture) {
      existingUser.profilePicture = { url: profile.picture };
    }

    if (email === PREMIUM_OWNER_EMAIL) {
      existingUser.isPremium = true;
    }

    await existingUser.save();
    return existingUser;
  }

  const username = await buildUniqueGoogleUsername(email);

  try {
    return await UserModel.create({
      email,
      username,
      fullName: profile.name,
      googleId: profile.sub,
      authProviders: ["google"],
      profilePicture: profile.picture ? { url: profile.picture } : undefined,
      isEmailVerified: true,
      isPremium: email === PREMIUM_OWNER_EMAIL
    });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new AppError(
        409,
        "GOOGLE_ACCOUNT_CONFLICT",
        "An account was created with these Google details. Please sign in again."
      );
    }

    throw error;
  }
};

export const requestSignupOtp = async (req: Request, res: Response): Promise<void> => {
  const input = req.body as RequestSignupOtpInput;
  await ensureRegistrationAvailable(input.email, input.username);

  const otp = await issueOtp({
    email: input.email,
    purpose: "email_verification",
    ipAddress: req.ip,
    userAgent: req.get("user-agent")
  });

  res.status(202).json({
    success: true,
    message: "A verification OTP has been sent to your email.",
    data: {
      expiresAt: otp.expiresAt,
      retryAfterSeconds: otp.retryAfterSeconds
    }
  });
};

export const verifySignup = async (req: Request, res: Response): Promise<void> => {
  const input = req.body as VerifySignupInput;
  await ensureRegistrationAvailable(input.email, input.username);
  await verifyAndConsumeOtp(input.email, "email_verification", input.otp);

  const passwordHash = await bcrypt.hash(input.password, env.BCRYPT_SALT_ROUNDS);

  try {
    const user = await UserModel.create({
      email: input.email,
      username: input.username,
      fullName: input.fullName,
      passwordHash,
      authProviders: ["email"],
      isEmailVerified: true,
      isPremium: input.email === PREMIUM_OWNER_EMAIL
    });

    respondWithSession(res, user, 201);
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new AppError(
        409,
        "ACCOUNT_ALREADY_EXISTS",
        "The email or username was registered while this request was being processed."
      );
    }

    throw error;
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  const input = req.body as LoginInput;
  const identifier = input.identifier.startsWith("@")
    ? input.identifier.slice(1)
    : input.identifier;
  const user = await UserModel.findOne(
    identifier.includes("@") ? { email: identifier } : { username: identifier }
  ).select("+passwordHash");

  if (!user || !(await user.comparePassword(input.password))) {
    throw new AppError(
      401,
      "INVALID_CREDENTIALS",
      "Email, username, or password is incorrect."
    );
  }

  if (user.status !== "active") {
    throw new AppError(403, "ACCOUNT_UNAVAILABLE", "This account is not active.");
  }

  if (!user.isEmailVerified) {
    throw new AppError(403, "EMAIL_NOT_VERIFIED", "Verify your email before signing in.");
  }

  respondWithSession(res, user);
};

export const refreshSession = async (req: Request, res: Response): Promise<void> => {
  const input = req.body as RefreshTokenInput;
  const payload = verifyRefreshToken(input.refreshToken);
  const user = await UserModel.findOne({ _id: payload.sub, status: "active" });

  if (!user) {
    throw new AppError(401, "USER_NOT_AVAILABLE", "The authenticated user is unavailable.");
  }

  respondWithSession(res, user);
};

export const startGoogleAuth = async (_req: Request, res: Response): Promise<void> => {
  const { state, url } = createGoogleAuthorizationUrl();

  res.cookie(GOOGLE_STATE_COOKIE, state, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: GOOGLE_STATE_MAX_AGE_MS,
    path: "/api/auth/google/callback"
  });
  res.redirect(url);
};

export const googleCallback = async (req: Request, res: Response): Promise<void> => {
  const code = typeof req.query.code === "string" ? req.query.code : undefined;
  const state = typeof req.query.state === "string" ? req.query.state : undefined;
  const providerError =
    typeof req.query.error === "string" ? req.query.error : undefined;
  const cookieState = readCookie(req, GOOGLE_STATE_COOKIE);

  res.clearCookie(GOOGLE_STATE_COOKIE, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/auth/google/callback"
  });

  if (providerError) {
    throw new AppError(401, "GOOGLE_AUTH_CANCELLED", "Google sign-in was not completed.");
  }

  if (!code || !state || !cookieState || !constantTimeEqual(state, cookieState)) {
    throw new AppError(400, "GOOGLE_STATE_MISMATCH", "Google sign-in state could not be verified.");
  }

  verifyGoogleState(state);
  const profile = await exchangeGoogleCode(code);
  const user = await provisionGoogleUser(profile);
  respondWithSession(res, user);
};

export const authenticateGoogleToken = async (
  req: Request,
  res: Response
): Promise<void> => {
  const input = req.body as GoogleTokenInput;
  const profile = await verifyGoogleIdToken(input.idToken);
  const user = await provisionGoogleUser(profile);
  respondWithSession(res, user);
};
