import { type HydratedDocument, type Types, Schema, model } from "mongoose";

export type AdminAuditAction =
  | "admin_login"
  | "admin_logout"
  | "premium_granted"
  | "premium_revoked"
  | "premium_request_rejected";

export interface AdminAuditLog {
  actorEmail: string;
  action: AdminAuditAction;
  targetUser?: Types.ObjectId;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
  updatedAt: Date;
}

const adminAuditLogSchema = new Schema(
  {
    actorEmail: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true
    },
    action: {
      type: String,
      required: true,
      enum: [
        "admin_login",
        "admin_logout",
        "premium_granted",
        "premium_revoked",
        "premium_request_rejected"
      ],
      index: true
    },
    targetUser: {
      type: Schema.Types.ObjectId,
      ref: "User",
      index: true
    },
    metadata: {
      type: Schema.Types.Mixed
    },
    ipAddress: {
      type: String,
      trim: true
    },
    userAgent: {
      type: String,
      trim: true,
      maxlength: 512
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

adminAuditLogSchema.index({ createdAt: -1, action: 1 });

export type AdminAuditLogDocument = HydratedDocument<AdminAuditLog>;

export const AdminAuditLogModel = model<AdminAuditLog>(
  "AdminAuditLog",
  adminAuditLogSchema
);
