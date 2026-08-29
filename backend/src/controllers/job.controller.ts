import { timingSafeEqual } from "crypto";
import type { Request, Response } from "express";
import { env } from "../config/env";
import { processDueBirthdays } from "../services/birthdayAutomation.service";
import { AppError } from "../utils/errors";

const secretMatches = (provided: string, expected: string): boolean => {
  const left = Buffer.from(provided);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
};

export const runBirthdayJob = async (
  req: Request,
  res: Response
): Promise<void> => {
  const secret = req.header("x-bondera-job-secret") ?? "";
  if (!env.BIRTHDAY_JOB_SECRET) {
    throw new AppError(503, "BIRTHDAY_JOB_NOT_CONFIGURED", "Birthday job is not configured.");
  }
  if (!secretMatches(secret, env.BIRTHDAY_JOB_SECRET)) {
    throw new AppError(401, "JOB_AUTH_INVALID", "Job authentication is invalid.");
  }

  const result = await processDueBirthdays();
  res.status(result.failures > 0 ? 207 : 200).json({
    success: true,
    data: result
  });
};
