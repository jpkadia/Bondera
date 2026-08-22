import { Types } from "mongoose";
import {
  ConnectionModel,
  type ConnectionDocument
} from "../models/Connection";
import { MessageModel } from "../models/Message";
import { UserModel } from "../models/User";
import { AppError } from "../utils/errors";

export const buildConnectionPairKey = (
  firstUserId: Types.ObjectId | string,
  secondUserId: Types.ObjectId | string
): string => [firstUserId.toString(), secondUserId.toString()].sort().join(":");

export const isConnectionChatEnabled = (connection: ConnectionDocument): boolean => {
  return (
    connection.status === "accepted" &&
    Boolean(connection.requesterCategory) &&
    Boolean(connection.recipientCategory)
  );
};

export const assertChatEnabled = async (
  firstUserId: Types.ObjectId | string,
  secondUserId: Types.ObjectId | string
): Promise<ConnectionDocument> => {
  const connection = await ConnectionModel.findOne({
    pairKey: buildConnectionPairKey(firstUserId, secondUserId),
    status: "accepted"
  });

  if (!connection || !isConnectionChatEnabled(connection)) {
    throw new AppError(
      403,
      "CHAT_NOT_ENABLED",
      "Both users must accept and categorize the connection before chatting."
    );
  }

  return connection;
};

interface PublicUserSummary {
  id: string;
  username: string;
  fullName?: string;
  uniqueId: string;
  profilePicture?: {
    url?: string;
  };
}

export interface ConnectionView {
  id: string;
  status: ConnectionDocument["status"];
  direction: "incoming" | "outgoing";
  category?: ConnectionDocument["requesterCategory"];
  chatEnabled: boolean;
  awaitingYourCategory: boolean;
  awaitingOtherCategory: boolean;
  requestedAt: Date;
  respondedAt?: Date;
  lastMessageAt?: Date;
  unreadCount: number;
  otherUser: PublicUserSummary;
}

export const buildConnectionViews = async (
  connections: ConnectionDocument[],
  currentUserId: Types.ObjectId
): Promise<ConnectionView[]> => {
  const otherUserIds = connections.map((connection) =>
    connection.requester.equals(currentUserId)
      ? connection.recipient
      : connection.requester
  );
  const users = await UserModel.find({
    _id: { $in: otherUserIds },
    status: { $ne: "deleted" }
  })
    .select("username fullName uniqueId profilePicture")
    .lean();
  const usersById = new Map(users.map((user) => [user._id.toString(), user]));
  const unreadCounts = await MessageModel.aggregate<{
    _id: Types.ObjectId;
    count: number;
  }>([
    {
      $match: {
        connection: { $in: connections.map((connection) => connection._id) },
        recipient: currentUserId,
        isDeleted: false,
        receipts: {
          $elemMatch: {
            user: currentUserId,
            seenAt: null
          }
        }
      }
    },
    { $group: { _id: "$connection", count: { $sum: 1 } } }
  ]);
  const unreadByConnection = new Map(
    unreadCounts.map((item) => [item._id.toString(), item.count])
  );

  return connections.flatMap((connection) => {
    const isRequester = connection.requester.equals(currentUserId);
    const otherUserId = isRequester ? connection.recipient : connection.requester;
    const otherUser = usersById.get(otherUserId.toString());

    if (!otherUser) {
      return [];
    }

    const ownCategory = isRequester
      ? connection.requesterCategory
      : connection.recipientCategory;
    const otherCategory = isRequester
      ? connection.recipientCategory
      : connection.requesterCategory;

    return [
      {
        id: connection._id.toString(),
        status: connection.status,
        direction: isRequester ? "outgoing" : "incoming",
        category: ownCategory,
        chatEnabled: isConnectionChatEnabled(connection),
        awaitingYourCategory:
          connection.status === "accepted" && !ownCategory,
        awaitingOtherCategory:
          connection.status === "accepted" && !otherCategory,
        requestedAt: connection.requestedAt,
        respondedAt: connection.respondedAt,
        lastMessageAt: connection.lastMessageAt,
        unreadCount: unreadByConnection.get(connection._id.toString()) ?? 0,
        otherUser: {
          id: otherUser._id.toString(),
          username: otherUser.username,
          fullName: otherUser.fullName,
          uniqueId: otherUser.uniqueId,
          profilePicture: otherUser.profilePicture?.url
            ? { url: otherUser.profilePicture.url }
            : undefined
        }
      }
    ];
  });
};
