import { z } from "zod";

export const askPrivateAiSchema = z
  .object({
    question: z
      .string()
      .trim()
      .min(2, "Question is required.")
      .max(1000, "Question cannot exceed 1000 characters.")
  })
  .strict();

export type AskPrivateAiInput = z.infer<typeof askPrivateAiSchema>;
