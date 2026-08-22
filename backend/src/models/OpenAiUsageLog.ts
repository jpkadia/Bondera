import {
  type HydratedDocument,
  type Types,
  Schema,
  model
} from "mongoose";

export interface OpenAiUsageLog {
  user: Types.ObjectId;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
  estimatedCostInr: number;
  textMessagesAnalyzed: number;
  historyTruncated: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const openAiUsageLogSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    model: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    inputTokens: {
      type: Number,
      required: true,
      min: 0
    },
    outputTokens: {
      type: Number,
      required: true,
      min: 0
    },
    cachedInputTokens: {
      type: Number,
      required: true,
      min: 0,
      default: 0
    },
    totalTokens: {
      type: Number,
      required: true,
      min: 0
    },
    estimatedCostUsd: {
      type: Number,
      required: true,
      min: 0
    },
    estimatedCostInr: {
      type: Number,
      required: true,
      min: 0
    },
    textMessagesAnalyzed: {
      type: Number,
      required: true,
      min: 0
    },
    historyTruncated: {
      type: Boolean,
      required: true,
      default: false
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

openAiUsageLogSchema.index({ createdAt: -1 });
openAiUsageLogSchema.index({ user: 1, createdAt: -1 });

export type OpenAiUsageLogDocument = HydratedDocument<OpenAiUsageLog>;

export const OpenAiUsageLogModel = model<OpenAiUsageLog>(
  "OpenAiUsageLog",
  openAiUsageLogSchema
);
