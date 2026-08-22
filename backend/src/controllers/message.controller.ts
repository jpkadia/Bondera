import type { Response } from "express";
import { Types } from "mongoose";
import {
  CLOUDINARY_CHAT_MEDIA_FOLDER,
  CLOUDINARY_PROFILE_PICTURES_FOLDER
} from "../constants/media";
import { ConnectionModel } from "../models/Connection";
import { MessageModel, type MessageMedia } from "../models/Message";
import { UserModel } from "../models/User";
import {
  destroyCloudinaryAsset,
  uploadCloudinaryFiles
} from "../services/cloudinary.service";
import { isConnectionChatEnabled } from "../services/connection.service";
import {
  createChatMessage,
  serializeMessage
} from "../services/message.service";
import { emitToUser, isUserOnline } from "../socket/realtime";
import type { AuthenticatedRequest } from "../types/http";
import { AppError } from "../utils/errors";
import type {
  ChatMediaMessageInput,
  EditMessageInput,
  MessageHistoryQuery
} from "../validation/message.validation";

const EDIT_WINDOW_MS = 10 * 60 * 1000;

const requireCurrentUser = (req: AuthenticatedRequest) => {
  if (!req.user) {
    throw new AppError(401, "AUTH_REQUIRED", "Authentication is required.");
  }

  return req.user;
};

const requireParam = (req: AuthenticatedRequest, name: string): string => {
  const value = req.params[name];

  if (!value) {
    throw new AppError(422, "ROUTE_PARAMETER_REQUIRED", `${name} is required.`);
  }

  return value;
};

const cleanupResourceType = (
  asset: Pick<MessageMedia, "resourceType" | "mimeType">
): "image" | "video" | "raw" => {
  if (asset.resourceType !== "auto") {
    return asset.resourceType;
  }

  if (asset.mimeType.startsWith("video/") || asset.mimeType.startsWith("audio/")) {
    return "video";
  }

  return asset.mimeType.startsWith("image/") ? "image" : "raw";
};

export const listMessages = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  const currentUser = requireCurrentUser(req);
  const connectionId = requireParam(req, "connectionId");
  const query = req.query as unknown as MessageHistoryQuery;
  const connection = await ConnectionModel.findOne({
    _id: connectionId,
    $or: [
      { requester: currentUser.mongoId },
      { recipient: currentUser.mongoId }
    ]
  });

  if (!connection) {
    throw new AppError(404, "CONNECTION_NOT_FOUND", "Connection was not found.");
  }

  if (!isConnectionChatEnabled(connection)) {
    throw new AppError(
      403,
      "CHAT_NOT_ENABLED",
      "Both users must categorize the connection before viewing chat."
    );
  }

  const messages = await MessageModel.find({
    connection: connection._id,
    ...(query.before ? { createdAt: { $lt: new Date(query.before) } } : {})
  })
    .sort({ createdAt: -1, _id: -1 })
    .limit(query.limit);
  const ordered = messages.reverse();
  const firstUnread = await MessageModel.findOne({
    connection: connection._id,
    recipient: currentUser.mongoId,
    isDeleted: false,
    receipts: {
      $elemMatch: {
        user: currentUser.mongoId,
        seenAt: null
      }
    }
  })
    .select("_id")
    .sort({ createdAt: 1, _id: 1 })
    .lean();

  res.status(200).json({
    success: true,
    data: {
      messages: ordered.map(serializeMessage),
      firstUnreadMessageId: firstUnread?._id.toString() ?? null,
      nextCursor:
        messages.length === query.limit && ordered[0]
          ? ordered[0].createdAt.toISOString()
          : null
    }
  });
};

export const editMessage = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  const currentUser = requireCurrentUser(req);
  const messageId = requireParam(req, "messageId");
  const { text } = req.body as EditMessageInput;
  const message = await MessageModel.findOne({
    _id: messageId,
    sender: currentUser.mongoId
  });

  if (!message) {
    throw new AppError(404, "MESSAGE_NOT_FOUND", "Only the sender can edit this message.");
  }

  if (message.isDeleted) {
    throw new AppError(409, "MESSAGE_DELETED", "Deleted messages cannot be edited.");
  }

  if (!message.text) {
    throw new AppError(409, "MESSAGE_NOT_EDITABLE", "Only text messages can be edited.");
  }

  if (Date.now() - message.createdAt.getTime() > EDIT_WINDOW_MS) {
    throw new AppError(403, "MESSAGE_EDIT_WINDOW_EXPIRED", "Messages can be edited for 10 minutes.");
  }

  message.text = text.trim();
  message.editedAt = new Date();
  await message.save();

  const serialized = serializeMessage(message);
  emitToUser(message.sender.toString(), "message:edited", serialized);
  emitToUser(message.recipient.toString(), "message:edited", serialized);

  res.status(200).json({
    success: true,
    data: { message: serialized }
  });
};

export const uploadChatMessage = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  const currentUser = requireCurrentUser(req);
  const input = req.body as ChatMediaMessageInput;
  const files = Array.isArray(req.files) ? req.files : [];

  if (files.length === 0) {
    throw new AppError(422, "MEDIA_REQUIRED", "Select at least one media file.");
  }

  if (input.clientMessageId) {
    const existing = await MessageModel.findOne({
      sender: currentUser.mongoId,
      clientMessageId: input.clientMessageId
    });

    if (existing) {
      res.status(200).json({
        success: true,
        data: { message: serializeMessage(existing) }
      });
      return;
    }
  }

  const uploaded = await uploadCloudinaryFiles(
    files,
    CLOUDINARY_CHAT_MEDIA_FOLDER,
    "auto"
  );
  let message;

  try {
    message = await createChatMessage({
      senderId: currentUser.mongoId,
      recipientId: new Types.ObjectId(input.recipientId),
      text: input.text,
      media: uploaded,
      clientMessageId: input.clientMessageId,
      delivered: isUserOnline(input.recipientId)
    });
  } catch (error) {
    await Promise.allSettled(
      uploaded.map((asset) =>
        destroyCloudinaryAsset(asset.publicId, asset.resourceType)
      )
    );
    throw error;
  }

  const attachedIds = new Set(message.media.map((asset) => asset.publicId));
  const unattached = uploaded.filter((asset) => !attachedIds.has(asset.publicId));

  if (unattached.length > 0) {
    await Promise.allSettled(
      unattached.map((asset) =>
        destroyCloudinaryAsset(asset.publicId, asset.resourceType)
      )
    );
  }

  const serialized = serializeMessage(message);
  emitToUser(input.recipientId, "message:new", serialized);
  emitToUser(currentUser.id, "message:new", serialized);

  res.status(201).json({
    success: true,
    data: { message: serialized }
  });
};

export const unsendMessage = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  const currentUser = requireCurrentUser(req);
  const messageId = requireParam(req, "messageId");
  const message = await MessageModel.findOne({
    _id: messageId,
    sender: currentUser.mongoId
  });

  if (!message) {
    throw new AppError(404, "MESSAGE_NOT_FOUND", "Only the sender can unsend this message.");
  }

  if (!message.isDeleted) {
    message.isDeleted = true;
    message.deletedAt = new Date();
    message.deletedBy = currentUser.mongoId;
    await message.save();
  }

  const cleanupResults = await Promise.allSettled(
    message.media.map((asset) =>
      destroyCloudinaryAsset(
        asset.publicId,
        cleanupResourceType(asset)
      )
    )
  );
  const mediaCleanupPending = cleanupResults.some(
    (result) => result.status === "rejected"
  );

  if (!mediaCleanupPending && !message.cloudinaryDestroyedAt) {
    message.cloudinaryDestroyedAt = new Date();
    await message.save();
  }

  const eventPayload = {
    messageId: message._id.toString(),
    connectionId: message.connection.toString(),
    deletedAt: message.deletedAt
  };
  emitToUser(message.sender.toString(), "message:unsent", eventPayload);
  emitToUser(message.recipient.toString(), "message:unsent", eventPayload);

  res.status(200).json({
    success: true,
    data: {
      messageId: message._id.toString(),
      mediaCleanupPending
    }
  });
};

export const uploadProfilePicture = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  const currentUser = requireCurrentUser(req);

  if (!req.file) {
    throw new AppError(422, "PROFILE_PICTURE_REQUIRED", "Select a profile picture.");
  }

  const [uploaded] = await uploadCloudinaryFiles(
    [req.file],
    CLOUDINARY_PROFILE_PICTURES_FOLDER,
    "image"
  );

  if (!uploaded) {
    throw new AppError(502, "CLOUDINARY_UPLOAD_FAILED", "Profile picture upload failed.");
  }

  const user = await UserModel.findById(currentUser.mongoId);

  if (!user) {
    await destroyCloudinaryAsset(uploaded.publicId, uploaded.resourceType);
    throw new AppError(404, "USER_NOT_FOUND", "User was not found.");
  }

  const previousPicture = user.profilePicture;

  try {
    user.profilePicture = {
      url: uploaded.secureUrl,
      publicId: uploaded.publicId
    };
    await user.save();
  } catch (error) {
    await destroyCloudinaryAsset(uploaded.publicId, uploaded.resourceType);
    throw error;
  }

  let previousCleanupPending = false;

  if (previousPicture?.publicId) {
    try {
      await destroyCloudinaryAsset(previousPicture.publicId, "image");
    } catch {
      previousCleanupPending = true;
    }
  }

  res.status(200).json({
    success: true,
    data: {
      profilePicture: user.profilePicture,
      previousCleanupPending
    }
  });
};
