import { z } from "zod";

const objectIdSchema = z.string().regex(/^[a-fA-F0-9]{24}$/, "ID is invalid.");

export const askPrivateAiSchema = z
  .object({
    question: z
      .string()
      .trim()
      .min(2, "Question is required.")
      .max(1000, "Question cannot exceed 1000 characters."),
    conversationId: objectIdSchema.optional()
  })
  .strict();

export const aiConversationParamsSchema = z.object({
  conversationId: objectIdSchema
});

export type AskPrivateAiInput = z.infer<typeof askPrivateAiSchema>;
