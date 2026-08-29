import { z } from "zod";
import {
  birthDateSchema,
  emailSchema,
  usernameSchema
} from "./auth.validation";
import { isValidTimeZone } from "../utils/birthdayAutomation";

export const updateProfileSchema = z
  .object({
    fullName: z.string().trim().max(80, "Full name cannot exceed 80 characters.").optional(),
    username: usernameSchema.optional(),
    birthDate: birthDateSchema.optional()
  })
  .strict()
  .refine(
    (input) =>
      input.fullName !== undefined ||
      input.username !== undefined ||
      input.birthDate !== undefined,
    "Provide a name, username, or birthdate to update."
  );

export const requestEmailChangeOtpSchema = z
  .object({ email: emailSchema })
  .strict();

export const verifyEmailChangeSchema = z
  .object({
    email: emailSchema,
    otp: z.string().regex(/^\d{6}$/, "OTP must contain exactly 6 digits.")
  })
  .strict();

export const deviceContextSchema = z
  .object({
    timeZone: z
      .string()
      .trim()
      .min(1)
      .max(100)
      .refine(isValidTimeZone, "Device timezone is invalid."),
    expoPushToken: z
      .string()
      .trim()
      .regex(
        /^(Expo|Exponent)PushToken\[[A-Za-z0-9_-]+\]$/,
        "Expo push token is invalid."
      )
      .max(512)
      .optional(),
    platform: z.enum(["android", "ios"]).optional()
  })
  .strict()
  .refine(
    (input) => Boolean(input.expoPushToken) === Boolean(input.platform),
    "Push token and platform must be provided together."
  );

export const unregisterDeviceSchema = z
  .object({
    expoPushToken: z.string().trim().min(20).max(512)
  })
  .strict();

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type RequestEmailChangeOtpInput = z.infer<typeof requestEmailChangeOtpSchema>;
export type VerifyEmailChangeInput = z.infer<typeof verifyEmailChangeSchema>;
export type DeviceContextInput = z.infer<typeof deviceContextSchema>;
export type UnregisterDeviceInput = z.infer<typeof unregisterDeviceSchema>;
