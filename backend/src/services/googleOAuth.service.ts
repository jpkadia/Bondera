import { randomBytes } from "crypto";
import { OAuth2Client } from "google-auth-library";
import jwt, { type JwtPayload } from "jsonwebtoken";
import { env } from "../config/env";
import {
  AUTH_TOKEN_ISSUER,
  GOOGLE_OAUTH_STATE_AUDIENCE
} from "../constants/auth";
import { AppError } from "../utils/errors";

export interface VerifiedGoogleProfile {
  sub: string;
  email: string;
  email_verified: true;
  name?: string;
  picture?: string;
}

const googleClient = new OAuth2Client(
  env.GOOGLE_CLIENT_ID,
  env.GOOGLE_CLIENT_SECRET,
  env.GOOGLE_CALLBACK_URL
);

const acceptedGoogleClientIds = [
  env.GOOGLE_CLIENT_ID,
  env.GOOGLE_ANDROID_CLIENT_ID,
  env.GOOGLE_IOS_CLIENT_ID
].filter((clientId): clientId is string => Boolean(clientId));

interface GoogleStatePayload extends JwtPayload {
  type: "google_oauth_state";
  nonce: string;
}

export const createGoogleAuthorizationUrl = (): { url: string; state: string } => {
  const state = jwt.sign(
    {
      type: "google_oauth_state",
      nonce: randomBytes(24).toString("hex")
    },
    env.JWT_ACCESS_SECRET,
    {
      expiresIn: "10m",
      issuer: AUTH_TOKEN_ISSUER,
      audience: GOOGLE_OAUTH_STATE_AUDIENCE
    }
  );

  return {
    state,
    url: googleClient.generateAuthUrl({
      access_type: "offline",
      prompt: "select_account",
      include_granted_scopes: false,
      scope: ["openid", "email", "profile"],
      state
    })
  };
};

export const verifyGoogleState = (state: string): void => {
  try {
    const payload = jwt.verify(state, env.JWT_ACCESS_SECRET, {
      issuer: AUTH_TOKEN_ISSUER,
      audience: GOOGLE_OAUTH_STATE_AUDIENCE
    });

    if (
      typeof payload === "string" ||
      (payload as GoogleStatePayload).type !== "google_oauth_state" ||
      typeof (payload as GoogleStatePayload).nonce !== "string"
    ) {
      throw new Error("Unexpected state payload.");
    }
  } catch {
    throw new AppError(400, "GOOGLE_STATE_INVALID", "Google sign-in state is invalid or expired.");
  }
};

export const exchangeGoogleCode = async (
  code: string
): Promise<VerifiedGoogleProfile> => {
  let idToken: string | null | undefined;

  try {
    const tokenResponse = await googleClient.getToken(code);
    idToken = tokenResponse.tokens.id_token;
  } catch {
    throw new AppError(401, "GOOGLE_CODE_INVALID", "Google authorization could not be verified.");
  }

  if (!idToken) {
    throw new AppError(401, "GOOGLE_ID_TOKEN_MISSING", "Google did not return an identity token.");
  }

  return verifyGoogleIdToken(idToken);
};

export const verifyGoogleIdToken = async (
  idToken: string
): Promise<VerifiedGoogleProfile> => {
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: acceptedGoogleClientIds
    });
    const payload = ticket.getPayload();

    if (!payload?.sub || !payload.email || payload.email_verified !== true) {
      throw new Error("Google account email is not verified.");
    }

    return {
      sub: payload.sub,
      email: payload.email,
      email_verified: true,
      name: payload.name,
      picture: payload.picture
    };
  } catch {
    throw new AppError(401, "GOOGLE_IDENTITY_INVALID", "Google identity verification failed.");
  }
};
