import { type HydratedDocument, type Types, Schema, model } from "mongoose";

export interface AiTurn {
  conversation: Types.ObjectId;
  user: Types.ObjectId;
  question: string;
  answer: string;
  textMessagesAnalyzed: number;
  historyTruncated: boolean;
  createdAt: Date;
}

const aiTurnSchema = new Schema<AiTurn>(
  {
    conversation: {
      type: Schema.Types.ObjectId,
      ref: "AiConversation",
      required: true,
      index: true
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    question: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000
    },
    answer: {
      type: String,
      required: true
    },
    textMessagesAnalyzed: {
      type: Number,
      required: true,
      min: 0
    },
    historyTruncated: {
      type: Boolean,
      required: true
    }
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false }
);

aiTurnSchema.index({ conversation: 1, createdAt: 1, _id: 1 });
aiTurnSchema.index({ user: 1, createdAt: -1 });

export type AiTurnDocument = HydratedDocument<AiTurn>;
export const AiTurnModel = model<AiTurn>("AiTurn", aiTurnSchema);
