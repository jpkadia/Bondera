import { timingSafeEqual } from "crypto";
import type { Response } from "express";
import { Types } from "mongoose";
import { env } from "../config/env";
import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_TTL_SECONDS,
  MAX_PREMIUM_USERS
} from "../constants/admin";
import { AdminAuditLogModel } from "../models/AdminAuditLog";
import { ConnectionModel } from "../models/Connection";
import { MessageModel } from "../models/Message";
import { PremiumRequestModel } from "../models/PremiumRequest";
import { UserModel } from "../models/User";
import { createAdminSession } from "../services/adminToken.service";
import { getOpenAiUsageStats } from "../services/openaiUsage.service";
import {
  rejectPremiumRequest,
  setPremiumStatus
} from "../services/premium.service";
import { issueOtp, verifyAndConsumeOtp } from "../services/otp.service";
import type { AuthenticatedAdminRequest } from "../types/http";
import { AppError } from "../utils/errors";
import type {
  AdminLoginInput,
  AdminPaginationInput,
  AdminVerifyOtpInput,
  PremiumToggleInput,
  PremiumRequestDecisionInput
} from "../validation/admin.validation";

const constantTimeEqual = (left: string, right: string): boolean => {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
};

const adminCookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  sameSite: "strict" as const,
  maxAge: ADMIN_SESSION_TTL_SECONDS * 1000,
  path: "/"
};

const escapeRegex = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const pagination = (query: AdminPaginationInput) => ({
  page: query.page,
  limit: query.limit,
  skip: (query.page - 1) * query.limit
});

const requireAdmin = (req: AuthenticatedAdminRequest) => {
  if (!req.admin) {
    throw new AppError(401, "ADMIN_AUTH_REQUIRED", "Admin authentication is required.");
  }

  return req.admin;
};

export const requestAdminLoginOtp = async (
  req: AuthenticatedAdminRequest,
  res: Response
): Promise<void> => {
  const input = req.body as AdminLoginInput;
  const validCredentials =
    constantTimeEqual(input.email, ADMIN_EMAIL) &&
    constantTimeEqual(input.password, ADMIN_PASSWORD);

  if (!validCredentials) {
    throw new AppError(401, "ADMIN_CREDENTIALS_INVALID", "Admin credentials are invalid.");
  }

  const otp = await issueOtp({
    email: ADMIN_EMAIL,
    purpose: "admin_login",
    ipAddress: req.ip,
    userAgent: req.get("user-agent")
  });

  res.status(202).json({
    success: true,
    message: "Admin OTP sent.",
    data: {
      expiresAt: otp.expiresAt,
      retryAfterSeconds: otp.retryAfterSeconds
    }
  });
};

export const verifyAdminLoginOtp = async (
  req: AuthenticatedAdminRequest,
  res: Response
): Promise<void> => {
  const input = req.body as AdminVerifyOtpInput;

  if (!constantTimeEqual(input.email, ADMIN_EMAIL)) {
    throw new AppError(401, "ADMIN_OTP_INVALID", "Admin OTP is invalid.");
  }

  await verifyAndConsumeOtp(ADMIN_EMAIL, "admin_login", input.otp);
  const session = createAdminSession();
  res.cookie(ADMIN_SESSION_COOKIE, session.token, adminCookieOptions);

  await AdminAuditLogModel.create({
    actorEmail: ADMIN_EMAIL,
    action: "admin_login",
    ipAddress: req.ip,
    userAgent: req.get("user-agent")
  });

  res.status(200).json({
    success: true,
    data: {
      email: ADMIN_EMAIL,
      csrfToken: session.csrfToken,
      expiresInSeconds: ADMIN_SESSION_TTL_SECONDS
    }
  });
};

export const getAdminSession = async (
  req: AuthenticatedAdminRequest,
  res: Response
): Promise<void> => {
  const admin = requireAdmin(req);
  res.status(200).json({
    success: true,
    data: {
      email: admin.email,
      csrfToken: admin.csrfToken
    }
  });
};

export const logoutAdmin = async (
  req: AuthenticatedAdminRequest,
  res: Response
): Promise<void> => {
  const admin = requireAdmin(req);
  res.clearCookie(ADMIN_SESSION_COOKIE, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/"
  });

  await AdminAuditLogModel.create({
    actorEmail: admin.email,
    action: "admin_logout",
    ipAddress: req.ip,
    userAgent: req.get("user-agent")
  });

  res.status(204).send();
};

export const getAdminOverview = async (
  _req: AuthenticatedAdminRequest,
  res: Response
): Promise<void> => {
  const [users, premiumUsers, pendingPremiumRequests, rooms, activeRooms, deletedMessages] = await Promise.all([
    UserModel.countDocuments(),
    UserModel.countDocuments({ isPremium: true }),
    PremiumRequestModel.countDocuments({ status: "pending" }),
    ConnectionModel.countDocuments(),
    ConnectionModel.countDocuments({ status: "accepted" }),
    MessageModel.countDocuments({ isDeleted: true })
  ]);

  res.status(200).json({
    success: true,
    data: {
      users,
      premiumUsers,
      premiumLimit: MAX_PREMIUM_USERS,
      pendingPremiumRequests,
      rooms,
      activeRooms,
      deletedMessages
    }
  });
};

export const getAdminOpenAiUsage = async (
  _req: AuthenticatedAdminRequest,
  res: Response
): Promise<void> => {
  const usage = await getOpenAiUsageStats();

  res.status(200).json({
    success: true,
    data: usage
  });
};

export const listAdminUsers = async (
  req: AuthenticatedAdminRequest,
  res: Response
): Promise<void> => {
  const query = req.query as unknown as AdminPaginationInput;
  const { page, limit, skip } = pagination(query);
  const search = query.search?.trim();
  const filter = search
    ? {
        $or: [
          { email: { $regex: escapeRegex(search), $options: "i" } },
          { username: { $regex: escapeRegex(search), $options: "i" } },
          { uniqueId: { $regex: escapeRegex(search), $options: "i" } }
        ]
      }
    : {};
  const [users, total] = await Promise.all([
    UserModel.find(filter)
      .select(
        "email username fullName uniqueId authProviders isEmailVerified isPremium status createdAt lastSeenAt"
      )
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    UserModel.countDocuments(filter)
  ]);

  res.status(200).json({
    success: true,
    data: {
      items: users.map((user) => ({
        id: user._id.toString(),
        email: user.email,
        username: user.username,
        fullName: user.fullName,
        uniqueId: user.uniqueId,
        authProviders: user.authProviders,
        isEmailVerified: user.isEmailVerified,
        isPremium: user.isPremium,
        status: user.status,
        createdAt: user.createdAt,
        lastSeenAt: user.lastSeenAt
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.max(Math.ceil(total / limit), 1)
      }
    }
  });
};

export const toggleUserPremium = async (
  req: AuthenticatedAdminRequest,
  res: Response
): Promise<void> => {
  const admin = requireAdmin(req);
  const userId = req.params.userId;
  const { isPremium } = req.body as PremiumToggleInput;

  if (!userId) {
    throw new AppError(422, "USER_ID_REQUIRED", "User ID is required.");
  }

  const result = await setPremiumStatus({
    userId,
    isPremium,
    actorEmail: admin.email,
    ipAddress: req.ip,
    userAgent: req.get("user-agent")
  });
  res.status(200).json({
    success: true,
    data: result
  });
};

export const listPremiumRequests = async (
  req: AuthenticatedAdminRequest,
  res: Response
): Promise<void> => {
  const query = req.query as unknown as AdminPaginationInput;
  const { page, limit, skip } = pagination(query);
  const [requests, total] = await Promise.all([
    PremiumRequestModel.find()
      .sort({ status: 1, requestedAt: 1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    PremiumRequestModel.countDocuments()
  ]);
  const users = await UserModel.find({
    _id: { $in: requests.map((request) => request.user) }
  })
    .select("email username fullName uniqueId isPremium status")
    .lean();
  const usersById = new Map(users.map((user) => [user._id.toString(), user]));

  res.status(200).json({
    success: true,
    data: {
      items: requests.flatMap((request) => {
        const user = usersById.get(request.user.toString());
        return user ? [{
          id: request._id.toString(),
          status: request.status,
          requestedAt: request.requestedAt,
          decidedAt: request.decidedAt,
          adminNote: request.adminNote,
          user: {
            id: user._id.toString(),
            email: user.email,
            username: user.username,
            fullName: user.fullName,
            uniqueId: user.uniqueId,
            isPremium: user.isPremium,
            status: user.status
          }
        }] : [];
      }),
      pagination: {
        page,
        limit,
        total,
        pages: Math.max(Math.ceil(total / limit), 1)
      }
    }
  });
};

export const decidePremiumRequest = async (
  req: AuthenticatedAdminRequest,
  res: Response
): Promise<void> => {
  const admin = requireAdmin(req);
  const requestId = req.params.requestId;
  const input = req.body as PremiumRequestDecisionInput;
  const request = await PremiumRequestModel.findById(requestId);

  if (!request) {
    throw new AppError(404, "PREMIUM_REQUEST_NOT_FOUND", "Premium request was not found.");
  }
  if (request.status !== "pending") {
    throw new AppError(
      409,
      "PREMIUM_REQUEST_NOT_PENDING",
      "This premium request is no longer pending."
    );
  }

  if (input.decision === "approved") {
    await setPremiumStatus({
      userId: request.user,
      isPremium: true,
      actorEmail: admin.email,
      ipAddress: req.ip,
      userAgent: req.get("user-agent")
    });
  } else {
    await rejectPremiumRequest(
      request._id,
      admin.email,
      input.adminNote,
      req.ip,
      req.get("user-agent")
    );
  }

  res.status(200).json({ success: true, data: { requestId, status: input.decision } });
};

export const listAdminConnections = async (
  req: AuthenticatedAdminRequest,
  res: Response
): Promise<void> => {
  const query = req.query as unknown as AdminPaginationInput;
  const { page, limit, skip } = pagination(query);
  const [connections, total] = await Promise.all([
    ConnectionModel.find()
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    ConnectionModel.countDocuments()
  ]);
  const userIds = connections.flatMap((connection) => [
    connection.requester,
    connection.recipient
  ]);
  const users = await UserModel.find({ _id: { $in: userIds } })
    .select("username email uniqueId")
    .lean();
  const usersById = new Map(users.map((user) => [user._id.toString(), user]));

  res.status(200).json({
    success: true,
    data: {
      items: connections.map((connection) => ({
        id: connection._id.toString(),
        status: connection.status,
        requester: usersById.get(connection.requester.toString()),
        recipient: usersById.get(connection.recipient.toString()),
        requesterCategory: connection.requesterCategory,
        recipientCategory: connection.recipientCategory,
        requestedAt: connection.requestedAt,
        respondedAt: connection.respondedAt,
        removedAt: connection.removedAt,
        lastMessageAt: connection.lastMessageAt,
        updatedAt: connection.updatedAt
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.max(Math.ceil(total / limit), 1)
      }
    }
  });
};

export const listDeletedMessages = async (
  req: AuthenticatedAdminRequest,
  res: Response
): Promise<void> => {
  const query = req.query as unknown as AdminPaginationInput;
  const { page, limit, skip } = pagination(query);
  const [messages, total] = await Promise.all([
    MessageModel.find({ isDeleted: true })
      .sort({ deletedAt: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    MessageModel.countDocuments({ isDeleted: true })
  ]);
  const userIds = messages.flatMap((message) => [message.sender, message.recipient]);
  const users = await UserModel.find({ _id: { $in: userIds } })
    .select("username email uniqueId")
    .lean();
  const usersById = new Map(users.map((user) => [user._id.toString(), user]));

  res.status(200).json({
    success: true,
    data: {
      items: messages.map((message) => ({
        id: message._id.toString(),
        connectionId: message.connection.toString(),
        sender: usersById.get(message.sender.toString()),
        recipient: usersById.get(message.recipient.toString()),
        text: message.text,
        kind: message.kind,
        media: message.media.map((asset) => ({
          secureUrl: asset.secureUrl,
          publicId: asset.publicId,
          resourceType: asset.resourceType,
          originalName: asset.originalName,
          mimeType: asset.mimeType,
          bytes: asset.bytes
        })),
        createdAt: message.createdAt,
        deletedAt: message.deletedAt,
        cloudinaryDestroyedAt: message.cloudinaryDestroyedAt
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.max(Math.ceil(total / limit), 1)
      }
    }
  });
};

export const listAdminAuditLogs = async (
  req: AuthenticatedAdminRequest,
  res: Response
): Promise<void> => {
  const query = req.query as unknown as AdminPaginationInput;
  const { page, limit, skip } = pagination(query);
  const [logs, total] = await Promise.all([
    AdminAuditLogModel.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    AdminAuditLogModel.countDocuments()
  ]);
  const targetIds = logs
    .map((log) => log.targetUser)
    .filter((id): id is Types.ObjectId => Boolean(id));
  const users = await UserModel.find({ _id: { $in: targetIds } })
    .select("username email uniqueId")
    .lean();
  const usersById = new Map(users.map((user) => [user._id.toString(), user]));

  res.status(200).json({
    success: true,
    data: {
      items: logs.map((log) => ({
        id: log._id.toString(),
        actorEmail: log.actorEmail,
        action: log.action,
        targetUser: log.targetUser
          ? usersById.get(log.targetUser.toString())
          : undefined,
        metadata: log.metadata,
        ipAddress: log.ipAddress,
        createdAt: log.createdAt
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.max(Math.ceil(total / limit), 1)
      }
    }
  });
};
