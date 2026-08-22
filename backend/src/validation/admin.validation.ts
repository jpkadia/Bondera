import { z } from "zod";

const adminEmailSchema = z
  .string()
  .trim()
  .email("Enter a valid email address.")
  .transform((email) => email.toLowerCase());

export const adminLoginSchema = z
  .object({
    email: adminEmailSchema,
    password: z.string().min(1).max(128)
  })
  .strict();

export const adminVerifyOtpSchema = z
  .object({
    email: adminEmailSchema,
    otp: z.string().regex(/^\d{6}$/, "OTP must contain exactly 6 digits.")
  })
  .strict();

export const premiumToggleSchema = z
  .object({
    isPremium: z.boolean()
  })
  .strict();

export const adminUserParamsSchema = z.object({
  userId: z.string().regex(/^[a-fA-F0-9]{24}$/, "User ID is invalid.")
});

export const adminPaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().trim().max(100).optional()
});

export type AdminLoginInput = z.infer<typeof adminLoginSchema>;
export type AdminVerifyOtpInput = z.infer<typeof adminVerifyOtpSchema>;
export type PremiumToggleInput = z.infer<typeof premiumToggleSchema>;
export type AdminPaginationInput = z.infer<typeof adminPaginationSchema>;
