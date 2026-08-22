import { Types } from "mongoose";
import { env } from "../config/env";
import { ConnectionModel } from "../models/Connection";
import { MessageModel } from "../models/Message";
import { UserModel } from "../models/User";

const URL_PATTERN =
  /\b(?:https?:\/\/|www\.|cloudinary:\/\/|res\.cloudinary\.com\/|data:(?:image|video|audio|application)\/)[^\s]+/gi;

export const sanitizeMessageText = (text: string): string => {
  return text.replace(URL_PATTERN, "[URL omitted]").trim();
};

interface ContactContext {
  username: string;
  displayName: string;
  category?: "Family" | "Friends" | "Professional";
  status: "pending" | "accepted" | "rejected" | "removed";
  direction: "incoming" | "outgoing";
  chatEnabled: boolean;
}

interface TextMessageContext {
  timestamp: string;
  direction: "sent" | "received";
  contactUsername: string;
  contactName: string;
  text: string;
}

export interface PrivateChatContext {
  generatedAt: string;
  user: {
    username: string;
    displayName: string;
  };
  connectionSummary: {
    totalAccepted: number;
    family: number;
    friends: number;
    professional: number;
    acceptedUncategorized: number;
    pendingIncoming: number;
    pendingOutgoing: number;
  };
  contacts: ContactContext[];
  textMessages: TextMessageContext[];
  messageWindow: {
    included: number;
    maximumQueried: number;
    truncated: boolean;
    oldestIncludedAt?: string;
    newestIncludedAt?: string;
  };
}

export const buildPrivateChatContext = async (
  currentUserId: Types.ObjectId
): Promise<PrivateChatContext> => {
  const [currentUser, connections, recentMessages] = await Promise.all([
    UserModel.findById(currentUserId).select("username fullName").lean(),
    ConnectionModel.find({
      $or: [{ requester: currentUserId }, { recipient: currentUserId }]
    })
      .select(
        "requester recipient status requesterCategory recipientCategory requestedAt respondedAt"
      )
      .lean(),
    MessageModel.find({
      $or: [{ sender: currentUserId }, { recipient: currentUserId }],
      isDeleted: false,
      text: { $type: "string", $ne: "" }
    })
      .select("text sender recipient createdAt -_id")
      .sort({ createdAt: -1 })
      .limit(env.AI_MAX_MESSAGES)
      .lean()
  ]);

  if (!currentUser) {
    throw new Error("Authenticated user context could not be loaded.");
  }

  const contactIds = new Set<string>();

  for (const connection of connections) {
    const otherId = connection.requester.equals(currentUserId)
      ? connection.recipient
      : connection.requester;
    contactIds.add(otherId.toString());
  }

  for (const message of recentMessages) {
    const otherId = message.sender.equals(currentUserId)
      ? message.recipient
      : message.sender;
    contactIds.add(otherId.toString());
  }

  const contactUsers = await UserModel.find({
    _id: { $in: [...contactIds].map((id) => new Types.ObjectId(id)) }
  })
    .select("username fullName")
    .lean();
  const usersById = new Map(
    contactUsers.map((user) => [
      user._id.toString(),
      {
        username: user.username,
        displayName: sanitizeMessageText(user.fullName || user.username)
      }
    ])
  );

  const contacts: ContactContext[] = connections.flatMap((connection) => {
    const isRequester = connection.requester.equals(currentUserId);
    const otherId = isRequester ? connection.recipient : connection.requester;
    const otherUser = usersById.get(otherId.toString());

    if (!otherUser) {
      return [];
    }

    const category = isRequester
      ? connection.requesterCategory
      : connection.recipientCategory;
    const chatEnabled =
      connection.status === "accepted" &&
      Boolean(connection.requesterCategory) &&
      Boolean(connection.recipientCategory);

    return [
      {
        username: otherUser.username,
        displayName: otherUser.displayName,
        category,
        status: connection.status,
        direction: isRequester ? "outgoing" : "incoming",
        chatEnabled
      }
    ];
  });

  const acceptedContacts = contacts.filter((contact) => contact.status === "accepted");
  const messageCandidates: TextMessageContext[] = recentMessages.flatMap((message) => {
    if (!message.text) {
      return [];
    }

    const isSender = message.sender.equals(currentUserId);
    const otherId = isSender ? message.recipient : message.sender;
    const otherUser = usersById.get(otherId.toString());

    if (!otherUser) {
      return [];
    }

    return [
      {
        timestamp: message.createdAt.toISOString(),
        direction: isSender ? "sent" : "received",
        contactUsername: otherUser.username,
        contactName: otherUser.displayName,
        text: sanitizeMessageText(message.text)
      }
    ];
  });
  const selectedNewestFirst: TextMessageContext[] = [];
  let contextCharacters = 0;

  for (const message of messageCandidates) {
    const messageCharacters = JSON.stringify(message).length;

    if (
      selectedNewestFirst.length > 0 &&
      contextCharacters + messageCharacters > env.AI_CONTEXT_CHAR_LIMIT
    ) {
      break;
    }

    selectedNewestFirst.push(message);
    contextCharacters += messageCharacters;
  }

  const textMessages = selectedNewestFirst.reverse();

  return {
    generatedAt: new Date().toISOString(),
    user: {
      username: currentUser.username,
      displayName: sanitizeMessageText(currentUser.fullName || currentUser.username)
    },
    connectionSummary: {
      totalAccepted: acceptedContacts.length,
      family: acceptedContacts.filter((contact) => contact.category === "Family").length,
      friends: acceptedContacts.filter((contact) => contact.category === "Friends").length,
      professional: acceptedContacts.filter(
        (contact) => contact.category === "Professional"
      ).length,
      acceptedUncategorized: acceptedContacts.filter((contact) => !contact.category).length,
      pendingIncoming: contacts.filter(
        (contact) => contact.status === "pending" && contact.direction === "incoming"
      ).length,
      pendingOutgoing: contacts.filter(
        (contact) => contact.status === "pending" && contact.direction === "outgoing"
      ).length
    },
    contacts,
    textMessages,
    messageWindow: {
      included: textMessages.length,
      maximumQueried: env.AI_MAX_MESSAGES,
      truncated:
        recentMessages.length === env.AI_MAX_MESSAGES ||
        textMessages.length < messageCandidates.length,
      oldestIncludedAt: textMessages[0]?.timestamp,
      newestIncludedAt: textMessages.at(-1)?.timestamp
    }
  };
};
