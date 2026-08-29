import { Types } from "mongoose";
import { BirthdayDispatchModel } from "../models/BirthdayDispatch";
import { ConnectionModel } from "../models/Connection";
import { MessageModel } from "../models/Message";
import { UserModel, type UserDocument } from "../models/User";
import { emitToUser, isUserOnline } from "../socket/realtime";
import {
  birthdayDueAtLocalMidnight,
  birthdayMessageClientId
} from "../utils/birthdayAutomation";
import { createChatMessage, serializeMessage } from "./message.service";
import { sendPushToUser } from "./pushNotification.service";

const DISPATCH_LEASE_MS = 10 * 60 * 1000;
const BIRTHDAY_MESSAGE = "Happy Birthday! 🎉 Wishing you a wonderful day.";

const displayName = (user: UserDocument): string =>
  user.fullName?.trim() || `@${user.username}`;

const acquireDispatch = async (
  birthdayUser: UserDocument,
  localDate: string,
  now: Date
) => {
  const current = await BirthdayDispatchModel.findOne({
    birthdayUser: birthdayUser._id,
    localDate
  });

  if (current?.status === "completed") return undefined;
  if (current?.status === "processing" && current.leaseUntil > now) {
    return undefined;
  }

  const leaseUntil = new Date(now.getTime() + DISPATCH_LEASE_MS);
  if (current) {
    current.status = "processing";
    current.leaseUntil = leaseUntil;
    current.lastError = undefined;
    await current.save();
    return current;
  }

  try {
    return await BirthdayDispatchModel.create({
      birthdayUser: birthdayUser._id,
      localDate,
      timeZone: birthdayUser.timeZone,
      status: "processing",
      leaseUntil
    });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: number }).code === 11000
    ) {
      return undefined;
    }
    throw error;
  }
};

const processBirthdayUser = async (
  birthdayUser: UserDocument,
  localDate: string,
  now: Date
): Promise<{ messagesCreated: number; notificationSent: boolean }> => {
  const dispatch = await acquireDispatch(birthdayUser, localDate, now);
  if (!dispatch) return { messagesCreated: 0, notificationSent: false };

  let messagesCreated = dispatch.messagesCreated;
  let notificationSent = Boolean(dispatch.notificationSentAt);

  try {
    if (!dispatch.notificationSentAt) {
      const title = `Happy Birthday, ${displayName(birthdayUser)}! 🎉`;
      const body = "Bondera wishes you a wonderful birthday filled with happiness.";
      await sendPushToUser(birthdayUser._id, {
        title,
        body,
        channelId: "birthday",
        data: { type: "account_birthday", url: "/home" }
      });
      emitToUser(birthdayUser._id.toString(), "account:birthday", { title, body });
      dispatch.notificationSentAt = new Date();
      notificationSent = true;
      await dispatch.save();
    }

    const connections = await ConnectionModel.find({
      status: "accepted",
      requesterCategory: { $exists: true },
      recipientCategory: { $exists: true },
      $or: [
        { requester: birthdayUser._id },
        { recipient: birthdayUser._id }
      ]
    });
    const contactIds = connections.map((connection) =>
      connection.requester.equals(birthdayUser._id)
        ? connection.recipient
        : connection.requester
    );
    const contacts = await UserModel.find({
      _id: { $in: contactIds },
      status: "active"
    });
    const contactsById = new Map(
      contacts.map((contact) => [contact._id.toString(), contact])
    );

    for (const connection of connections) {
      const senderId = connection.requester.equals(birthdayUser._id)
        ? connection.recipient
        : connection.requester;
      const sender = contactsById.get(senderId.toString());
      if (!sender) continue;

      const clientMessageId = birthdayMessageClientId(
        birthdayUser._id.toString(),
        localDate
      );
      const existing = await MessageModel.exists({
        sender: senderId,
        clientMessageId
      });
      if (existing) continue;

      const message = await createChatMessage({
        senderId: new Types.ObjectId(senderId),
        recipientId: new Types.ObjectId(birthdayUser._id),
        text: BIRTHDAY_MESSAGE,
        clientMessageId,
        delivered: isUserOnline(birthdayUser._id.toString())
      });
      const serialized = serializeMessage(message);
      emitToUser(birthdayUser._id.toString(), "message:new", serialized);
      emitToUser(senderId.toString(), "message:new", serialized);
      await sendPushToUser(birthdayUser._id, {
        title: displayName(sender),
        body: BIRTHDAY_MESSAGE,
        channelId: "messages",
        data: {
          type: "birthday_message",
          connectionId: connection._id.toString(),
          url: `/chat/${connection._id.toString()}`
        }
      });
      messagesCreated += 1;
    }

    dispatch.messagesCreated = messagesCreated;
    dispatch.messagesCompletedAt = new Date();
    dispatch.status = "completed";
    dispatch.leaseUntil = new Date();
    await dispatch.save();
    return { messagesCreated, notificationSent };
  } catch (error) {
    dispatch.status = "failed";
    dispatch.leaseUntil = new Date();
    dispatch.lastError = error instanceof Error ? error.message : String(error);
    await dispatch.save().catch(() => undefined);
    throw error;
  }
};

export interface BirthdayJobResult {
  dueUsers: number;
  processedUsers: number;
  messagesCreated: number;
  failures: number;
}

export const processDueBirthdays = async (
  now = new Date()
): Promise<BirthdayJobResult> => {
  const users = await UserModel.find({
    status: "active",
    birthDate: { $exists: true, $ne: "" }
  });
  const due = users.flatMap((user) => {
    const local = birthdayDueAtLocalMidnight(user.birthDate!, user.timeZone, now);
    return local ? [{ user, localDate: local.localDate }] : [];
  });
  const result: BirthdayJobResult = {
    dueUsers: due.length,
    processedUsers: 0,
    messagesCreated: 0,
    failures: 0
  };

  for (const item of due) {
    try {
      const processed = await processBirthdayUser(item.user, item.localDate, now);
      if (processed.notificationSent || processed.messagesCreated > 0) {
        result.processedUsers += 1;
      }
      result.messagesCreated += processed.messagesCreated;
    } catch {
      result.failures += 1;
    }
  }

  return result;
};
