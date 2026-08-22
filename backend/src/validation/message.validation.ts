import { z } from "zod";

const objectIdSchema = z.string().regex(/^[a-fA-F0-9]{24}$/, "ID is invalid.");

const optionalMessageTextSchema = z.preprocess(
  (value) => {
    if (typeof value !== "string") {
      return value;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  },
  z.string().max(4000, "Message cannot exceed 4000 characters.").optional()
);

export const chatMediaMessageSchema = z
  .object({
    recipientId: objectIdSchema,
    text: optionalMessageTextSchema,
    clientMessageId: z.string().trim().min(8).max(64).optional()
  })
  .strict();

export const messageIdParamsSchema = z.object({
  messageId: objectIdSchema
});

export const editMessageSchema = z
  .object({
    text: z.string().trim().min(1, "Message cannot be empty.").max(4000)
  })
  .strict();

export const messageHistoryParamsSchema = z.object({
  connectionId: objectIdSchema
});

export const messageHistoryQuerySchema = z.object({
  before: z.string().datetime({ offset: true }).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30)
});

export type ChatMediaMessageInput = z.infer<typeof chatMediaMessageSchema>;
export type EditMessageInput = z.infer<typeof editMessageSchema>;
export type MessageHistoryQuery = z.infer<typeof messageHistoryQuerySchema>;
