import { env } from "../config/env";

export const ADMIN_EMAIL = env.ADMIN_EMAIL;

export const ADMIN_PASSWORD = env.ADMIN_PASSWORD;

export const ADMIN_SESSION_COOKIE = "bondera_admin_session";

export const ADMIN_SESSION_TTL_SECONDS = 30 * 60;

export const MAX_PREMIUM_USERS = 3;
