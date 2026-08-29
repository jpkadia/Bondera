import { type Types, Schema, model } from "mongoose";

export interface BirthdayDispatch {
  birthdayUser: Types.ObjectId;
  localDate: string;
  timeZone: string;
  status: "processing" | "completed" | "failed";
  leaseUntil: Date;
  notificationSentAt?: Date;
  messagesCompletedAt?: Date;
  messagesCreated: number;
  lastError?: string;
  createdAt: Date;
  updatedAt: Date;
}

const birthdayDispatchSchema = new Schema(
  {
    birthdayUser: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    localDate: {
      type: String,
      required: true,
      match: /^\d{4}-\d{2}-\d{2}$/
    },
    timeZone: {
      type: String,
      required: true,
      trim: true
    },
    status: {
      type: String,
      required: true,
      enum: ["processing", "completed", "failed"],
      default: "processing",
      index: true
    },
    leaseUntil: {
      type: Date,
      required: true
    },
    notificationSentAt: Date,
    messagesCompletedAt: Date,
    messagesCreated: {
      type: Number,
      required: true,
      default: 0,
      min: 0
    },
    lastError: {
      type: String,
      maxlength: 1000
    }
  },
  { timestamps: true, versionKey: false }
);

birthdayDispatchSchema.index(
  { birthdayUser: 1, localDate: 1 },
  { unique: true }
);

export const BirthdayDispatchModel = model<BirthdayDispatch>(
  "BirthdayDispatch",
  birthdayDispatchSchema
);
