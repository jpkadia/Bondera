import { z } from "zod";
import { PASSWORD_PATTERN, USERNAME_PATTERN } from "../constants/auth";
import { isValidBirthDate } from "../utils/birthDate";

export const emailSchema = z
  .string()
  .trim()
  .email("Enter a valid email address.")
  .transform((email) => email.toLowerCase());

export const usernameSchema = z
  .string()
  .trim()
  .min(3, "Username must be at least 3 characters.")
  .max(30, "Username cannot exceed 30 characters.")
  .regex(
    USERNAME_PATTERN,
    "Username may use lowercase letters, numbers, periods, and underscores, and must start and end with a letter or number."
  );

export const passwordSchema = z
  .string()
  .min(6, "Password must be at least 6 characters.")
  .max(128, "Password cannot exceed 128 characters.")
  .regex(
    PASSWORD_PATTERN,
    "Password must include an uppercase letter, number, and special character."
  );

export const birthDateSchema = z
  .string()
  .refine(
    isValidBirthDate,
    "Enter a valid birthdate in DD/MM/YYYY format."
  );

const signupFields = {
  email: emailSchema,
  username: usernameSchema,
  password: passwordSchema,
  birthDate: birthDateSchema,
  fullName: z
    .string()
    .trim()
    .min(1, "Full name is required.")
    .max(80, "Full name cannot exceed 80 characters.")
};

export const requestSignupOtpSchema = z.object(signupFields).strict();

export const verifySignupSchema = z
  .object({
    ...signupFields,
    otp: z.string().regex(/^\d{6}$/, "OTP must contain exactly 6 digits.")
  })
  .strict();

export const loginSchema = z
  .object({
    identifier: z
      .string()
      .trim()
      .min(3, "Enter your email address or username.")
      .max(254)
      .transform((value) => value.toLowerCase()),
    password: z.string().min(1).max(128)
  })
  .strict();

export const refreshTokenSchema = z
  .object({
    refreshToken: z.string().min(1, "Refresh token is required.")
  })
  .strict();

export const googleTokenSchema = z
  .object({
    idToken: z.string().trim().min(100, "A valid Google ID token is required.")
  })
  .strict();

const passwordResetIdentifierSchema = z
  .string()
  .trim()
  .min(3, "Enter your email address or username.")
  .max(254)
  .transform((value) => value.toLowerCase());

export const requestPasswordResetOtpSchema = z
  .object({ identifier: passwordResetIdentifierSchema })
  .strict();

export const verifyPasswordResetOtpSchema = z
  .object({
    identifier: passwordResetIdentifierSchema,
    otp: z.string().regex(/^\d{6}$/, "OTP must contain exactly 6 digits.")
  })
  .strict();

export const resetPasswordSchema = z
  .object({
    resetToken: z.string().trim().min(40).max(256),
    password: passwordSchema
  })
  .strict();

export type RequestSignupOtpInput = z.infer<typeof requestSignupOtpSchema>;
export type VerifySignupInput = z.infer<typeof verifySignupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
export type GoogleTokenInput = z.infer<typeof googleTokenSchema>;
export type RequestPasswordResetOtpInput = z.infer<
  typeof requestPasswordResetOtpSchema
>;
export type VerifyPasswordResetOtpInput = z.infer<
  typeof verifyPasswordResetOtpSchema
>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
