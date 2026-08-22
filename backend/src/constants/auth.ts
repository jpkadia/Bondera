export const PREMIUM_OWNER_EMAIL = "kadiyaparth612@gmail.com";

export const USERNAME_PATTERN = /^(?!.*\.\.)[a-z0-9](?:[a-z0-9._]{1,28}[a-z0-9])?$/;

export const PASSWORD_PATTERN =
  /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{6,}$/;

export const UNIQUE_ID_LENGTH = 10;

export const UNIQUE_ID_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

export const OTP_LENGTH = 6;

export const OTP_TTL_MINUTES = 10;

export const OTP_RESEND_COOLDOWN_SECONDS = 60;

export const OTP_MAX_ATTEMPTS = 5;

export const AUTH_TOKEN_ISSUER = "bondera-api";

export const AUTH_TOKEN_AUDIENCE = "bondera-client";

export const GOOGLE_OAUTH_STATE_AUDIENCE = "bondera-google-oauth";
