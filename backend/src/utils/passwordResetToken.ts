import { createHash, randomBytes } from "crypto";

export const createPasswordResetToken = (): string =>
  randomBytes(32).toString("base64url");

export const hashPasswordResetToken = (token: string): string =>
  createHash("sha256").update(token).digest("hex");
