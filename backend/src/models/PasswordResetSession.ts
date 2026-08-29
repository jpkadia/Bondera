import { type HydratedDocument, Schema, model } from "mongoose";

export interface PasswordResetSession {
  user: Schema.Types.ObjectId;
  tokenHash: string;
  expiresAt: Date;
  consumedAt?: Date;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
  updatedAt: Date;
}

const passwordResetSessionSchema = new Schema<PasswordResetSession>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    tokenHash: {
      type: String,
      required: true,
      unique: true,
      select: false
    },
    expiresAt: {
      type: Date,
      required: true
    },
    consumedAt: {
      type: Date
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
  { timestamps: true, versionKey: false }
);

passwordResetSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
passwordResetSessionSchema.index({ user: 1, consumedAt: 1, createdAt: -1 });

export type PasswordResetSessionDocument =
  HydratedDocument<PasswordResetSession>;

export const PasswordResetSessionModel = model<PasswordResetSession>(
  "PasswordResetSession",
  passwordResetSessionSchema
);
