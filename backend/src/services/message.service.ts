import { Types } from "mongoose";
import { ConnectionModel } from "../models/Connection";
import {
  MessageModel,
  type MessageDocument,
  type MessageMedia
} from "../models/Message";
import { UserModel } from "../models/User";
import { assertChatEnabled } from "./connection.service";
import { AppError } from "../utils/errors";

interface CreateChatMessageInput {
  senderId: Types.ObjectId;
  recipientId: Types.ObjectId;
  text?: string;
  media?: MessageMedia[];
  clientMessageId?: string;
  delivered: boolean;
}

export const serializeMessage = (message: MessageDocument) => ({
  id: message._id.toString(),
  connectionId: message.connection.toString(),
  senderId: message.sender.toString(),
  recipientId: message.recipient.toString(),
  clientMessageId: message.clientMessageId,
  text: message.isDeleted ? undefined : message.text,
  media: message.isDeleted
    ? []
    : message.media.map((asset) => ({
        id: asset._id?.toString(),
        url: asset.secureUrl,
        resourceType: asset.resourceType,
        format: asset.format,
        originalName: asset.originalName,
        mimeType: asset.mimeType,
        bytes: asset.bytes,
        width: asset.width,
        height: asset.height,
        durationSeconds: asset.durationSeconds
      })),
  kind: message.kind,
  reactions: message.isDeleted
    ? []
    : message.reactions.map((reaction) => ({
        userId: reaction.user.toString(),
        emoji: reaction.emoji,
        reactedAt: reaction.reactedAt
      })),
  receipts: message.receipts.map((receipt) => ({
    userId: receipt.user.toString(),
    deliveredAt: receipt.deliveredAt,
    seenAt: receipt.seenAt
  })),
  isDeleted: message.isDeleted,
  editedAt: message.editedAt,
  deletedAt: message.deletedAt,
  createdAt: message.createdAt,
  updatedAt: message.updatedAt
});

export const createChatMessage = async ({
  senderId,
  recipientId,
  text,
  media = [],
  clientMessageId,
  delivered
}: CreateChatMessageInput): Promise<MessageDocument> => {
  const normalizedText = text?.trim();

  if (!normalizedText && media.length === 0) {
    throw new AppError(422, "MESSAGE_EMPTY", "A message must include text or media.");
  }

  const [connection, recipientExists] = await Promise.all([
    assertChatEnabled(senderId, recipientId),
    UserModel.exists({ _id: recipientId, status: "active" })
  ]);

  if (!recipientExists) {
    throw new AppError(404, "RECIPIENT_NOT_AVAILABLE", "The recipient is unavailable.");
  }

  if (clientMessageId) {
    const existing = await MessageModel.findOne({ sender: senderId, clientMessageId });

    if (existing) {
      return existing;
    }
  }

  let message: MessageDocument;

  try {
    message = await MessageModel.create({
      connection: connection._id,
      sender: senderId,
      recipient: recipientId,
      clientMessageId,
      text: normalizedText,
      media,
      receipts: [
        {
          user: recipientId,
          ...(delivered ? { deliveredAt: new Date() } : {})
        }
      ]
    });
  } catch (error) {
    if (
      clientMessageId &&
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: number }).code === 11000
    ) {
      const existing = await MessageModel.findOne({ sender: senderId, clientMessageId });

      if (existing) {
        return existing;
      }
    }

    throw error;
  }

  await ConnectionModel.updateOne(
    { _id: connection._id, status: "accepted" },
    { $set: { lastMessageAt: message.createdAt } }
  );

  return message;
};
