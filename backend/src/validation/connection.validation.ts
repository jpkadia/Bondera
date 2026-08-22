import { z } from "zod";
import { CONTACT_CATEGORIES } from "../constants/categories";

const categorySchema = z.enum(CONTACT_CATEGORIES, {
  errorMap: () => ({ message: "Category must be Family, Friends, or Professional." })
});

export const sendConnectionRequestSchema = z
  .object({
    uniqueId: z
      .string()
      .trim()
      .transform((value) => value.toUpperCase())
      .pipe(
        z
          .string()
          .length(10, "User ID must contain exactly 10 characters.")
          .regex(/^[A-Z0-9]{10}$/, "User ID may contain uppercase letters and numbers only.")
      )
  })
  .strict();

export const connectionCategorySchema = z
  .object({
    category: categorySchema
  })
  .strict();

export const connectionIdParamsSchema = z.object({
  connectionId: z.string().regex(/^[a-fA-F0-9]{24}$/, "Connection ID is invalid.")
});

export type SendConnectionRequestInput = z.infer<typeof sendConnectionRequestSchema>;
export type ConnectionCategoryInput = z.infer<typeof connectionCategorySchema>;
