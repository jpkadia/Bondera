import { type Types, Schema, model } from "mongoose";

export type PremiumRequestStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "revoked";

export interface PremiumRequest {
  user: Types.ObjectId;
  status: PremiumRequestStatus;
  requestedAt: Date;
  decidedAt?: Date;
  decidedBy?: string;
  adminNote?: string;
  createdAt: Date;
  updatedAt: Date;
}

const premiumRequestSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true
    },
    status: {
      type: String,
      required: true,
      enum: ["pending", "approved", "rejected", "revoked"],
      default: "pending",
      index: true
    },
    requestedAt: {
      type: Date,
      required: true,
      default: Date.now
    },
    decidedAt: Date,
    decidedBy: {
      type: String,
      lowercase: true,
      trim: true
    },
    adminNote: {
      type: String,
      trim: true,
      maxlength: 500
    }
  },
  { timestamps: true, versionKey: false }
);

premiumRequestSchema.index({ status: 1, requestedAt: 1 });

export const PremiumRequestModel = model<PremiumRequest>(
  "PremiumRequest",
  premiumRequestSchema
);
