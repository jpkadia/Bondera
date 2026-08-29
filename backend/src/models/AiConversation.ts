import { type HydratedDocument, type Types, Schema, model } from "mongoose";

export interface AiConversation {
  user: Types.ObjectId;
  title: string;
  createdAt: Date;
  updatedAt: Date;
}

const aiConversationSchema = new Schema<AiConversation>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80
    }
  },
  { timestamps: true, versionKey: false }
);

aiConversationSchema.index({ user: 1, updatedAt: -1 });

export type AiConversationDocument = HydratedDocument<AiConversation>;
export const AiConversationModel = model<AiConversation>(
  "AiConversation",
  aiConversationSchema
);
