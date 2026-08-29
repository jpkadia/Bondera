import { type HydratedDocument, type Types, Schema, model } from "mongoose";

export interface DeviceInstallation {
  user: Types.ObjectId;
  expoPushToken: string;
  platform: "android" | "ios";
  timeZone: string;
  active: boolean;
  lastSeenAt: Date;
  invalidatedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const deviceInstallationSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    expoPushToken: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      maxlength: 512
    },
    platform: {
      type: String,
      required: true,
      enum: ["android", "ios"]
    },
    timeZone: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100
    },
    active: {
      type: Boolean,
      default: true,
      index: true
    },
    lastSeenAt: {
      type: Date,
      required: true,
      default: Date.now
    },
    invalidatedAt: Date
  },
  { timestamps: true, versionKey: false }
);

deviceInstallationSchema.index({ user: 1, active: 1, lastSeenAt: -1 });

export type DeviceInstallationDocument = HydratedDocument<DeviceInstallation>;

export const DeviceInstallationModel = model<DeviceInstallation>(
  "DeviceInstallation",
  deviceInstallationSchema
);
