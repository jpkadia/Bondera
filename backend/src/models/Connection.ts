import mongoose, {
  type HydratedDocument,
  type Types,
  Schema,
  model
} from "mongoose";
import {
  CONTACT_CATEGORIES,
  type ContactCategory
} from "../constants/categories";

export type ConnectionStatus = "pending" | "accepted" | "rejected" | "removed";

export interface Connection {
  pairKey: string;
  requester: Types.ObjectId;
  recipient: Types.ObjectId;
  status: ConnectionStatus;
  requesterCategory?: ContactCategory;
  recipientCategory?: ContactCategory;
  requestedAt: Date;
  respondedAt?: Date;
  removedAt?: Date;
  removedBy?: Types.ObjectId;
  lastMessageAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const connectionSchema = new Schema(
  {
    pairKey: {
      type: String,
      required: true,
      unique: true,
      index: true,
      immutable: true
    },
    requester: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    recipient: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    status: {
      type: String,
      enum: ["pending", "accepted", "rejected", "removed"],
      default: "pending",
      index: true
    },
    requesterCategory: {
      type: String,
      enum: CONTACT_CATEGORIES
    },
    recipientCategory: {
      type: String,
      enum: CONTACT_CATEGORIES,
      required: function requireRecipientCategory() {
        return this.status === "accepted";
      }
    },
    requestedAt: {
      type: Date,
      default: Date.now
    },
    respondedAt: {
      type: Date
    },
    removedAt: {
      type: Date
    },
    removedBy: {
      type: Schema.Types.ObjectId,
      ref: "User"
    },
    lastMessageAt: {
      type: Date
    }
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: {
      virtuals: true
    },
    toObject: {
      virtuals: true
    }
  }
);

connectionSchema.index({ requester: 1, status: 1, updatedAt: -1 });
connectionSchema.index({ recipient: 1, status: 1, updatedAt: -1 });
connectionSchema.index({ requester: 1, recipient: 1 }, { unique: true });

connectionSchema.virtual("isChatEnabled").get(function isChatEnabled() {
  return (
    this.status === "accepted" &&
    Boolean(this.requesterCategory) &&
    Boolean(this.recipientCategory)
  );
});

connectionSchema.pre("validate", function buildPairKey(next) {
  try {
    if (this.requester?.equals?.(this.recipient)) {
      throw new Error("A user cannot connect with themselves.");
    }

    const requesterId = this.requester?.toString();
    const recipientId = this.recipient?.toString();

    if (requesterId && recipientId && !this.pairKey) {
      this.pairKey = [requesterId, recipientId].sort().join(":");
    }

    if (this.status === "accepted" && !this.respondedAt) {
      this.respondedAt = new Date();
    }

    if (this.status === "removed" && !this.removedAt) {
      this.removedAt = new Date();
    }

    next();
  } catch (error) {
    next(error as Error);
  }
});

export type ConnectionDocument = HydratedDocument<Connection>;

export const ConnectionModel = model<Connection>("Connection", connectionSchema);
