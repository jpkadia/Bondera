import {
  type HydratedDocument,
  type Model,
  Schema,
  model
} from "mongoose";

export type OtpPurpose =
  | "email_verification"
  | "email_change"
  | "admin_login"
  | "password_reset";

export interface Otp {
  email: string;
  otpHash: string;
  purpose: OtpPurpose;
  attempts: number;
  maxAttempts: number;
  expiresAt: Date;
  consumedAt?: Date;
  targetUser?: Schema.Types.ObjectId;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
  updatedAt: Date;
}

const otpSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
      match: [/^\S+@\S+\.\S+$/, "Email address is invalid."]
    },
    otpHash: {
      type: String,
      required: true,
      select: false
    },
    purpose: {
      type: String,
      required: true,
      enum: ["email_verification", "email_change", "admin_login", "password_reset"],
      index: true
    },
    attempts: {
      type: Number,
      default: 0,
      min: 0,
      max: 5
    },
    maxAttempts: {
      type: Number,
      default: 5,
      min: 1,
      max: 10
    },
    expiresAt: {
      type: Date,
      required: true
    },
    consumedAt: {
      type: Date
    },
    targetUser: {
      type: Schema.Types.ObjectId,
      ref: "User"
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
    versionKey: false,
    toJSON: {
      transform: (_doc, ret) => {
        delete (ret as Record<string, unknown>).otpHash;
        return ret;
      }
    }
  }
);

otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
otpSchema.index({ email: 1, purpose: 1, consumedAt: 1, createdAt: -1 });

otpSchema.virtual("isExpired").get(function isExpired() {
  return this.expiresAt.getTime() <= Date.now();
});

otpSchema.virtual("isConsumed").get(function isConsumed() {
  return Boolean(this.consumedAt);
});

otpSchema.methods.canAttempt = function canAttempt(): boolean {
  return !this.consumedAt && this.expiresAt.getTime() > Date.now() && this.attempts < this.maxAttempts;
};

export interface OtpMethods {
  canAttempt(): boolean;
}

export type OtpDocument = HydratedDocument<Otp, OtpMethods>;

export const OtpModel = model<Otp, Model<Otp, object, OtpMethods>>(
  "Otp",
  otpSchema
);
