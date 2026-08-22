import type { Response } from "express";
import { ConnectionModel, type ConnectionDocument } from "../models/Connection";
import { UserModel } from "../models/User";
import {
  buildConnectionPairKey,
  buildConnectionViews
} from "../services/connection.service";
import type { AuthenticatedRequest } from "../types/http";
import { AppError } from "../utils/errors";
import type {
  ConnectionCategoryInput,
  SendConnectionRequestInput
} from "../validation/connection.validation";

const requireCurrentUser = (req: AuthenticatedRequest) => {
  if (!req.user) {
    throw new AppError(401, "AUTH_REQUIRED", "Authentication is required.");
  }

  return req.user;
};

const requireConnectionId = (req: AuthenticatedRequest): string => {
  const connectionId = req.params.connectionId;

  if (!connectionId) {
    throw new AppError(422, "CONNECTION_ID_REQUIRED", "Connection ID is required.");
  }

  return connectionId;
};

const isDuplicateKeyError = (error: unknown): boolean => {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: number }).code === 11000
  );
};

const buildSingleConnectionView = async (
  connection: ConnectionDocument,
  currentUserId: ReturnType<typeof requireCurrentUser>["mongoId"]
) => {
  const [view] = await buildConnectionViews([connection], currentUserId);

  if (!view) {
    throw new AppError(404, "CONNECTED_USER_NOT_FOUND", "The connected user is unavailable.");
  }

  return view;
};

const findParticipantConnection = async (
  connectionId: string,
  currentUserId: ReturnType<typeof requireCurrentUser>["mongoId"]
): Promise<ConnectionDocument> => {
  const connection = await ConnectionModel.findOne({
    _id: connectionId,
    $or: [{ requester: currentUserId }, { recipient: currentUserId }]
  });

  if (!connection) {
    throw new AppError(404, "CONNECTION_NOT_FOUND", "Connection was not found.");
  }

  return connection;
};

export const sendConnectionRequest = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  const currentUser = requireCurrentUser(req);
  const { uniqueId } = req.body as SendConnectionRequestInput;
  const targetUser = await UserModel.findOne({
    uniqueId,
    status: "active"
  }).select("_id");

  if (!targetUser) {
    throw new AppError(404, "USER_ID_NOT_FOUND", "No active user has this Bondera ID.");
  }

  if (targetUser._id.equals(currentUser.mongoId)) {
    throw new AppError(400, "SELF_CONNECTION_NOT_ALLOWED", "You cannot connect with yourself.");
  }

  const pairKey = buildConnectionPairKey(currentUser.mongoId, targetUser._id);
  const existing = await ConnectionModel.findOne({ pairKey });

  if (existing?.status === "pending") {
    const code = existing.requester.equals(currentUser.mongoId)
      ? "REQUEST_ALREADY_PENDING"
      : "INCOMING_REQUEST_ALREADY_PENDING";
    const message = existing.requester.equals(currentUser.mongoId)
      ? "A connection request is already pending."
      : "This user has already sent you a connection request.";
    throw new AppError(409, code, message, { connectionId: existing._id.toString() });
  }

  if (existing?.status === "accepted") {
    throw new AppError(409, "ALREADY_CONNECTED", "You are already connected with this user.");
  }

  let connection: ConnectionDocument;
  let statusCode = 201;

  if (existing) {
    const reopened = await ConnectionModel.findOneAndUpdate(
      {
        _id: existing._id,
        status: { $in: ["rejected", "removed"] }
      },
      {
        $set: {
          requester: currentUser.mongoId,
          recipient: targetUser._id,
          status: "pending",
          requestedAt: new Date()
        },
        $unset: {
          requesterCategory: 1,
          recipientCategory: 1,
          respondedAt: 1,
          removedAt: 1,
          removedBy: 1
        }
      },
      { new: true, runValidators: true }
    );

    if (!reopened) {
      throw new AppError(409, "CONNECTION_STATE_CHANGED", "Connection state changed. Try again.");
    }

    connection = reopened;
    statusCode = 200;
  } else {
    try {
      connection = await ConnectionModel.create({
        pairKey,
        requester: currentUser.mongoId,
        recipient: targetUser._id,
        status: "pending"
      });
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new AppError(
          409,
          "CONNECTION_ALREADY_EXISTS",
          "A connection with this user already exists."
        );
      }

      throw error;
    }
  }

  res.status(statusCode).json({
    success: true,
    message: "Connection request sent.",
    data: {
      connection: await buildSingleConnectionView(connection, currentUser.mongoId)
    }
  });
};

export const listConnectionRequests = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  const currentUser = requireCurrentUser(req);
  const connections = await ConnectionModel.find({
    status: "pending",
    $or: [{ requester: currentUser.mongoId }, { recipient: currentUser.mongoId }]
  }).sort({ requestedAt: -1 });
  const views = await buildConnectionViews(connections, currentUser.mongoId);

  res.status(200).json({
    success: true,
    data: {
      incoming: views.filter((connection) => connection.direction === "incoming"),
      outgoing: views.filter((connection) => connection.direction === "outgoing")
    }
  });
};

export const listContacts = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  const currentUser = requireCurrentUser(req);
  const connections = await ConnectionModel.find({
    status: "accepted",
    $or: [{ requester: currentUser.mongoId }, { recipient: currentUser.mongoId }]
  }).sort({ lastMessageAt: -1, updatedAt: -1 });
  const views = await buildConnectionViews(connections, currentUser.mongoId);

  res.status(200).json({
    success: true,
    data: {
      categories: {
        Family: views.filter((connection) => connection.category === "Family"),
        Friends: views.filter((connection) => connection.category === "Friends"),
        Professional: views.filter(
          (connection) => connection.category === "Professional"
        )
      },
      uncategorized: views.filter((connection) => !connection.category)
    }
  });
};

export const acceptConnectionRequest = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  const currentUser = requireCurrentUser(req);
  const { category } = req.body as ConnectionCategoryInput;
  const connection = await ConnectionModel.findOneAndUpdate(
    {
      _id: req.params.connectionId,
      recipient: currentUser.mongoId,
      status: "pending"
    },
    {
      $set: {
        status: "accepted",
        recipientCategory: category,
        respondedAt: new Date()
      }
    },
    { new: true, runValidators: true }
  );

  if (!connection) {
    throw new AppError(
      409,
      "REQUEST_NOT_ACCEPTABLE",
      "Only the recipient can accept an active connection request."
    );
  }

  res.status(200).json({
    success: true,
    message: "Connection accepted. Chat unlocks after both users choose a category.",
    data: {
      connection: await buildSingleConnectionView(connection, currentUser.mongoId)
    }
  });
};

export const rejectConnectionRequest = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  const currentUser = requireCurrentUser(req);
  const connection = await ConnectionModel.findOneAndUpdate(
    {
      _id: req.params.connectionId,
      recipient: currentUser.mongoId,
      status: "pending"
    },
    {
      $set: {
        status: "rejected",
        respondedAt: new Date()
      }
    },
    { new: true, runValidators: true }
  );

  if (!connection) {
    throw new AppError(
      409,
      "REQUEST_NOT_REJECTABLE",
      "Only the recipient can reject an active connection request."
    );
  }

  res.status(200).json({
    success: true,
    message: "Connection request rejected."
  });
};

export const setConnectionCategory = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  const currentUser = requireCurrentUser(req);
  const { category } = req.body as ConnectionCategoryInput;
  const existing = await findParticipantConnection(
    requireConnectionId(req),
    currentUser.mongoId
  );

  if (existing.status !== "accepted") {
    throw new AppError(
      409,
      "CONNECTION_NOT_ACCEPTED",
      "Categories can be assigned only after the connection is accepted."
    );
  }

  const categoryField = existing.requester.equals(currentUser.mongoId)
    ? "requesterCategory"
    : "recipientCategory";
  const connection = await ConnectionModel.findOneAndUpdate(
    {
      _id: existing._id,
      status: "accepted"
    },
    { $set: { [categoryField]: category } },
    { new: true, runValidators: true }
  );

  if (!connection) {
    throw new AppError(409, "CONNECTION_STATE_CHANGED", "Connection state changed. Try again.");
  }

  res.status(200).json({
    success: true,
    message: "Contact category updated.",
    data: {
      connection: await buildSingleConnectionView(connection, currentUser.mongoId)
    }
  });
};

export const removeConnection = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  const currentUser = requireCurrentUser(req);
  const existing = await findParticipantConnection(
    requireConnectionId(req),
    currentUser.mongoId
  );

  if (existing.status === "removed" || existing.status === "rejected") {
    res.status(204).send();
    return;
  }

  const connection = await ConnectionModel.findOneAndUpdate(
    {
      _id: existing._id,
      status: existing.status
    },
    {
      $set: {
        status: "removed",
        removedAt: new Date(),
        removedBy: currentUser.mongoId
      }
    },
    { new: true, runValidators: true }
  );

  if (!connection) {
    throw new AppError(409, "CONNECTION_STATE_CHANGED", "Connection state changed. Try again.");
  }

  res.status(200).json({
    success: true,
    message:
      existing.status === "pending"
        ? "Connection request deleted."
        : "Contact disconnected."
  });
};
