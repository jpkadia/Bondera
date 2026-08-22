import { z } from "zod";
import { emailSchema, usernameSchema } from "./auth.validation";

export const updateProfileSchema = z
  .object({
    fullName: z.string().trim().max(80, "Full name cannot exceed 80 characters.").optional(),
    username: usernameSchema.optional()
  })
  .strict()
  .refine(
    (input) => input.fullName !== undefined || input.username !== undefined,
    "Provide a name or username to update."
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

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type RequestEmailChangeOtpInput = z.infer<typeof requestEmailChangeOtpSchema>;
export type VerifyEmailChangeInput = z.infer<typeof verifyEmailChangeSchema>;
