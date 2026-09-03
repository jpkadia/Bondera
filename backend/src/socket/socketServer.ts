import type { Server as HttpServer } from "http";
import { createAdapter } from "@socket.io/redis-adapter";
import { Types } from "mongoose";
import { createClient, type RedisClientType } from "redis";
import { Server, type Socket } from "socket.io";
import { z } from "zod";
import { env } from "../config/env";
import { MessageModel } from "../models/Message";
import { UserModel } from "../models/User";
import { assertChatEnabled } from "../services/connection.service";
import {
  createChatMessage,
  serializeMessage
} from "../services/message.service";
import { sendPushToUser } from "../services/pushNotification.service";
import {
  isAuthTokenCurrent,
  verifyAccessToken
} from "../services/token.service";
import { AppError } from "../utils/errors";
import {
  reactionMessagePreview,
  shouldNotifyMessageOwnerOfReaction
} from "../utils/reactionNotification";
import {
  clearSocketServer,
  emitToUser,
  isUserActive,
  isUserOnline,
  setSocketServer,
  userRoom
} from "./realtime";

interface SocketUserData {
  userId: string;
  mongoId: Types.ObjectId;
  senderName: string;
  senderUsername: string;
  appActive: boolean;
}

interface SocketAckSuccess {
  success: true;
  data?: unknown;
}

interface SocketAckFailure {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

type SocketAck = (response: SocketAckSuccess | SocketAckFailure) => void;
type AuthenticatedSocket = Socket<Record<string, never>, Record<string, never>, Record<string, never>, SocketUserData>;

const objectIdSchema = z.string().regex(/^[a-fA-F0-9]{24}$/);
const sendMessageSchema = z
  .object({
    recipientId: objectIdSchema,
    text: z.string().trim().min(1).max(4000),
    clientMessageId: z.string().trim().min(8).max(64).optional()
  })
  .strict();
const reactionSchema = z
  .object({
    messageId: objectIdSchema,
    emoji: z.string().trim().min(1).max(16)
  })
  .strict();
const seenSchema = z.object({ messageId: objectIdSchema }).strict();
const typingSchema = z.object({ recipientId: objectIdSchema }).strict();
const presenceSchema = z.object({ active: z.boolean() }).strict();

let io: Server | undefined;
let redisPublisher: RedisClientType | undefined;
let redisSubscriber: RedisClientType | undefined;

const tokenFromSocket = (socket: Socket): string | undefined => {
  const authToken = socket.handshake.auth?.token;

  if (typeof authToken === "string" && authToken.trim()) {
    return authToken.trim().replace(/^Bearer\s+/i, "");
  }

  const authorization = socket.handshake.headers.authorization;

  if (authorization?.startsWith("Bearer ")) {
    return authorization.slice(7).trim();
  }

  return undefined;
};

const socketFailure = (error: unknown): SocketAckFailure => {
  if (error instanceof AppError) {
    return {
      success: false,
      error: {
        code: error.code,
        message: error.message,
        details: error.details
      }
    };
  }

  if (error instanceof z.ZodError) {
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Socket event data is invalid.",
        details: error.flatten().fieldErrors
      }
    };
  }

  return {
    success: false,
    error: {
      code: "REALTIME_ERROR",
      message: env.NODE_ENV === "production" ? "Realtime action failed." : String(error)
    }
  };
};

const runSocketAction = async (
  ack: SocketAck | undefined,
  action: () => Promise<unknown>
): Promise<void> => {
  try {
    const data = await action();
    ack?.({ success: true, data });
  } catch (error) {
    ack?.(socketFailure(error));
  }
};

const markPendingMessagesDelivered = async (userId: Types.ObjectId): Promise<void> => {
  const pending = await MessageModel.find({
    recipient: userId,
    isDeleted: false,
    receipts: {
      $elemMatch: {
        user: userId,
        deliveredAt: null
      }
    }
  })
    .select("_id sender connection")
    .lean();

  if (pending.length === 0) {
    return;
  }

  const deliveredAt = new Date();
  await MessageModel.updateMany(
    { _id: { $in: pending.map((message) => message._id) } },
    { $set: { "receipts.$[receipt].deliveredAt": deliveredAt } },
    {
      arrayFilters: [
        {
          "receipt.user": userId,
          "receipt.deliveredAt": null
        }
      ]
    }
  );

  const messagesBySender = new Map<string, string[]>();

  for (const message of pending) {
    const senderId = message.sender.toString();
    const ids = messagesBySender.get(senderId) ?? [];
    ids.push(message._id.toString());
    messagesBySender.set(senderId, ids);
  }

  for (const [senderId, messageIds] of messagesBySender) {
    emitToUser(senderId, "messages:delivered", {
      recipientId: userId.toString(),
      messageIds,
      deliveredAt
    });
  }
};

const registerSocketHandlers = (socket: AuthenticatedSocket): void => {
  const currentUserId = socket.data.mongoId;
  const currentUserIdString = socket.data.userId;
  const activeTypingRecipients = new Set<string>();

  socket.join(userRoom(currentUserIdString));
  void markPendingMessagesDelivered(currentUserId).catch(() => undefined);

  socket.on("message:send", (payload: unknown, ack?: SocketAck) => {
    void runSocketAction(ack, async () => {
      const input = sendMessageSchema.parse(payload);
      const recipientId = new Types.ObjectId(input.recipientId);
      const recipientOnline = isUserOnline(input.recipientId);
      const { message, created } = await createChatMessage({
        senderId: currentUserId,
        recipientId,
        text: input.text,
        clientMessageId: input.clientMessageId,
        delivered: recipientOnline
      });
      const serialized = serializeMessage(message);
      const realtimeMessage = {
        ...serialized,
        senderName: socket.data.senderName,
        senderUsername: socket.data.senderUsername
      };

      activeTypingRecipients.delete(input.recipientId);
      socket.to(userRoom(input.recipientId)).volatile.emit("typing:stop", {
        userId: currentUserIdString
      });
      if (created) {
        emitToUser(input.recipientId, "message:new", realtimeMessage);
        socket.to(userRoom(currentUserIdString)).emit("message:new", realtimeMessage);
      }
      if (created && !isUserActive(input.recipientId)) {
        void sendPushToUser(recipientId, {
          title: socket.data.senderName,
          body: input.text.length > 120 ? `${input.text.slice(0, 117)}...` : input.text,
          channelId: "messages",
          data: {
            type: "new_message",
            connectionId: serialized.connectionId,
            messageId: serialized.id,
            url: `/chat/${serialized.connectionId}`
          }
        }).catch(() => undefined);
      }
      return { message: serialized };
    });
  });

  socket.on("message:seen", (payload: unknown, ack?: SocketAck) => {
    void runSocketAction(ack, async () => {
      const input = seenSchema.parse(payload);
      const target = await MessageModel.findOne({
        _id: input.messageId,
        recipient: currentUserId,
        isDeleted: false
      });

      if (!target) {
        throw new AppError(404, "MESSAGE_NOT_FOUND", "Message was not found.");
      }

      await assertChatEnabled(currentUserId, target.sender);
      const unread = await MessageModel.find({
        connection: target.connection,
        recipient: currentUserId,
        createdAt: { $lte: target.createdAt },
        isDeleted: false,
        receipts: {
          $elemMatch: {
            user: currentUserId,
            seenAt: null
          }
        }
      })
        .select("_id")
        .lean();

      const seenAt = unread.length > 0 ? new Date() : undefined;
      const messageIds = unread.map((message) => message._id);
      if (seenAt) {
        await MessageModel.updateMany(
          { _id: { $in: messageIds } },
          {
            $set: {
              "receipts.$[receipt].deliveredAt": seenAt,
              "receipts.$[receipt].seenAt": seenAt
            }
          },
          {
            arrayFilters: [{ "receipt.user": currentUserId }]
          }
        );
      }

      const unreadCount = await MessageModel.countDocuments({
        connection: target.connection,
        recipient: currentUserId,
        isDeleted: false,
        receipts: {
          $elemMatch: {
            user: currentUserId,
            seenAt: null
          }
        }
      });

      const receiptPayload = {
        connectionId: target.connection.toString(),
        recipientId: currentUserIdString,
        messageIds: messageIds.map((id) => id.toString()),
        seenAt,
        unreadCount
      };
      if (seenAt) {
        emitToUser(target.sender.toString(), "messages:seen", receiptPayload);
      }
      emitToUser(currentUserIdString, "connection:unread", {
        connectionId: receiptPayload.connectionId,
        unreadCount
      });
      return receiptPayload;
    });
  });

  socket.on("message:react", (payload: unknown, ack?: SocketAck) => {
    void runSocketAction(ack, async () => {
      const input = reactionSchema.parse(payload);
      const message = await MessageModel.findOne({
        _id: input.messageId,
        isDeleted: false,
        $or: [{ sender: currentUserId }, { recipient: currentUserId }]
      });

      if (!message) {
        throw new AppError(404, "MESSAGE_NOT_FOUND", "Message was not found.");
      }

      const otherUserId = message.sender.equals(currentUserId)
        ? message.recipient
        : message.sender;
      await assertChatEnabled(currentUserId, otherUserId);

      const existingReaction = message.reactions.find((reaction) =>
        reaction.user.equals(currentUserId)
      );
      const reactions = message.reactions
        .filter((reaction) => !reaction.user.equals(currentUserId))
        .map((reaction) => ({
          user: reaction.user,
          emoji: reaction.emoji,
          reactedAt: reaction.reactedAt
        }));

      if (existingReaction?.emoji !== input.emoji) {
        reactions.push({
          user: currentUserId,
          emoji: input.emoji,
          reactedAt: new Date()
        });
      }

      message.set("reactions", reactions);
      await message.save();

      const reactionPayload = {
        messageId: message._id.toString(),
        reactions: message.reactions.map((reaction) => ({
          userId: reaction.user.toString(),
          emoji: reaction.emoji,
          reactedAt: reaction.reactedAt
        }))
      };
      emitToUser(currentUserIdString, "message:reaction", reactionPayload);

      const otherUserIdString = otherUserId.toString();
      const reactionWasAdded = existingReaction?.emoji !== input.emoji;
      const shouldNotifyOwner = shouldNotifyMessageOwnerOfReaction(
        currentUserIdString,
        message.sender.toString(),
        reactionWasAdded
      );

      if (shouldNotifyOwner) {
        const reactor = await UserModel.findById(currentUserId)
          .select("username fullName")
          .lean();
        const reactorName =
          reactor?.fullName?.trim() ||
          (reactor?.username ? `@${reactor.username}` : "Someone");
        const messagePreview = reactionMessagePreview(
          message.text,
          message.media.length
        );
        const notification = {
          connectionId: message.connection.toString(),
          messageId: message._id.toString(),
          reactorId: currentUserIdString,
          reactorName,
          emoji: input.emoji,
          messagePreview
        };

        emitToUser(otherUserIdString, "message:reaction", {
          ...reactionPayload,
          notification
        });
        if (!isUserActive(otherUserIdString)) {
          void sendPushToUser(otherUserId, {
            title: `${reactorName} reacted to your message`,
            body: `${input.emoji} ${messagePreview}`,
            channelId: "messages",
            data: {
              type: "message_reaction",
              connectionId: notification.connectionId,
              messageId: notification.messageId,
              url: `/chat/${notification.connectionId}`
            }
          }).catch(() => undefined);
        }
      } else {
        emitToUser(otherUserIdString, "message:reaction", reactionPayload);
      }
      return reactionPayload;
    });
  });

  const relayTyping = (event: "typing:start" | "typing:stop", payload: unknown, ack?: SocketAck) => {
    void runSocketAction(ack, async () => {
      const input = typingSchema.parse(payload);
      await assertChatEnabled(currentUserId, input.recipientId);
      if (!socket.connected) return { recipientId: input.recipientId };
      if (event === "typing:start") {
        activeTypingRecipients.add(input.recipientId);
      } else {
        activeTypingRecipients.delete(input.recipientId);
      }
      socket.to(userRoom(input.recipientId)).volatile.emit(event, {
        userId: currentUserIdString
      });
      return { recipientId: input.recipientId };
    });
  };

  socket.on("typing:start", (payload: unknown, ack?: SocketAck) =>
    relayTyping("typing:start", payload, ack)
  );
  socket.on("typing:stop", (payload: unknown, ack?: SocketAck) =>
    relayTyping("typing:stop", payload, ack)
  );

  socket.on("presence:update", (payload: unknown) => {
    const result = presenceSchema.safeParse(payload);
    if (result.success) socket.data.appActive = result.data.active;
  });

  socket.on("disconnect", () => {
    for (const recipientId of activeTypingRecipients) {
      emitToUser(recipientId, "typing:stop", {
        userId: currentUserIdString
      });
    }
    activeTypingRecipients.clear();
  });
};

export const initializeSocketServer = async (server: HttpServer): Promise<Server> => {
  io = new Server(server, {
    cors: {
      origin: env.CLIENT_ORIGIN.split(",").map((origin) => origin.trim()),
      credentials: true
    },
    maxHttpBufferSize: 1_000_000,
    transports: ["websocket", "polling"],
    connectionStateRecovery: {
      maxDisconnectionDuration: 2 * 60 * 1000,
      skipMiddlewares: false
    }
  });

  if (env.REDIS_URL) {
    redisPublisher = createClient({ url: env.REDIS_URL });
    redisSubscriber = redisPublisher.duplicate();
    await Promise.all([redisPublisher.connect(), redisSubscriber.connect()]);
    io.adapter(createAdapter(redisPublisher, redisSubscriber));
  }

  io.use(async (socket, next) => {
    try {
      const token = tokenFromSocket(socket);

      if (!token) {
        throw new AppError(401, "AUTH_REQUIRED", "Socket authentication is required.");
      }

      const payload = verifyAccessToken(token);
      const user = await UserModel.findOne({
        _id: payload.sub,
        status: "active"
      }).select("_id username fullName birthDate +authVersion");

      if (!user || !isAuthTokenCurrent(payload, user.authVersion)) {
        throw new AppError(401, "USER_NOT_AVAILABLE", "The authenticated user is unavailable.");
      }

      if (!user.birthDate) {
        throw new AppError(
          403,
          "BIRTH_DATE_REQUIRED",
          "Add your birthdate before using Bondera chat."
        );
      }

      socket.data.userId = user._id.toString();
      socket.data.mongoId = new Types.ObjectId(user._id);
      socket.data.senderName = user.fullName?.trim() || `@${user.username}`;
      socket.data.senderUsername = user.username;
      socket.data.appActive = true;
      next();
    } catch (error) {
      const failure = socketFailure(error);
      const authError = new Error(failure.error.message) as Error & { data?: unknown };
      authError.data = failure.error;
      next(authError);
    }
  });

  setSocketServer(io);
  io.on("connection", (socket) => registerSocketHandlers(socket as AuthenticatedSocket));
  return io;
};

export const closeSocketServer = async (): Promise<void> => {
  if (io) {
    await new Promise<void>((resolve) => io?.close(() => resolve()));
  }

  await Promise.allSettled([
    redisSubscriber?.quit() ?? Promise.resolve(),
    redisPublisher?.quit() ?? Promise.resolve()
  ]);
  redisSubscriber = undefined;
  redisPublisher = undefined;
  io = undefined;
  clearSocketServer();
};
