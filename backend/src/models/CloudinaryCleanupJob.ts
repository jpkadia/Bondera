import { Schema, model } from "mongoose";

export interface CloudinaryCleanupJob {
  publicId: string;
  resourceType: "image" | "video" | "raw";
  reason: string;
  attempts: number;
  nextAttemptAt: Date;
  lastError?: string;
  createdAt: Date;
  updatedAt: Date;
}

const cloudinaryCleanupJobSchema = new Schema<CloudinaryCleanupJob>(
  {
    publicId: { type: String, required: true, trim: true },
    resourceType: {
      type: String,
      required: true,
      enum: ["image", "video", "raw"]
    },
    reason: { type: String, required: true, trim: true, maxlength: 80 },
    attempts: { type: Number, required: true, default: 0, min: 0 },
    nextAttemptAt: { type: Date, required: true, default: Date.now, index: true },
    lastError: { type: String, trim: true, maxlength: 500 }
  },
  { timestamps: true, versionKey: false }
);

cloudinaryCleanupJobSchema.index({ nextAttemptAt: 1, attempts: 1 });
cloudinaryCleanupJobSchema.index(
  { publicId: 1, resourceType: 1 },
  { unique: true }
);

export const CloudinaryCleanupJobModel = model<CloudinaryCleanupJob>(
  "CloudinaryCleanupJob",
  cloudinaryCleanupJobSchema
);
