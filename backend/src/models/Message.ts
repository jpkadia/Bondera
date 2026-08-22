import {
  type HydratedDocument,
  type Types,
  Schema,
  model
} from "mongoose";
import {
  ALLOWED_CLOUDINARY_FOLDERS,
  MAX_FILES_PER_MESSAGE,
  MAX_MEDIA_FILE_SIZE_BYTES
} from "../constants/media";

export interface MessageMedia {
  _id?: Types.ObjectId;
  url: string;
  secureUrl: string;
  publicId: string;
  folder: (typeof ALLOWED_CLOUDINARY_FOLDERS)[number];
  resourceType: "image" | "video" | "raw" | "auto";
  format?: string;
  originalName?: string;
  mimeType: string;
  bytes: number;
  width?: number;
  height?: number;
  durationSeconds?: number;
}

export interface MessageReaction {
  user: Types.ObjectId;
  emoji: string;
  reactedAt: Date;
}

export interface MessageReceipt {
  user: Types.ObjectId;
  deliveredAt?: Date;
  seenAt?: Date;
}

export interface Message {
  connection: Types.ObjectId;
  sender: Types.ObjectId;
  recipient: Types.ObjectId;
  clientMessageId?: string;
  text?: string;
  media: MessageMedia[];
  kind: "text" | "media" | "mixed";
  reactions: MessageReaction[];
  receipts: MessageReceipt[];
  isDeleted: boolean;
  editedAt?: Date;
  deletedAt?: Date;
  deletedBy?: Types.ObjectId;
  cloudinaryDestroyedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const messageMediaSchema = new Schema(
  {
    url: {
      type: String,
      required: true,
      trim: true
    },
    secureUrl: {
      type: String,
      required: true,
      trim: true
    },
    publicId: {
      type: String,
      required: true,
      trim: true
    },
    folder: {
      type: String,
      required: true,
      enum: ALLOWED_CLOUDINARY_FOLDERS
    },
    resourceType: {
      type: String,
      required: true,
      enum: ["image", "video", "raw", "auto"]
    },
    format: {
      type: String,
      trim: true
    },
    originalName: {
      type: String,
      trim: true,
      maxlength: 255
    },
    mimeType: {
      type: String,
      required: true,
      trim: true
    },
    bytes: {
      type: Number,
      required: true,
      min: 1,
      max: MAX_MEDIA_FILE_SIZE_BYTES
    },
    width: {
      type: Number,
      min: 1
    },
    height: {
      type: Number,
      min: 1
    },
    durationSeconds: {
      type: Number,
      min: 0
    }
  },
  { _id: true }
);

const reactionSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    emoji: {
      type: String,
      required: true,
      trim: true,
      maxlength: 16
    },
    reactedAt: {
      type: Date,
      default: Date.now
    }
  },
  { _id: false }
);

const readReceiptSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    deliveredAt: {
      type: Date
    },
    seenAt: {
      type: Date
    }
  },
  { _id: false }
);

const messageSchema = new Schema(
  {
    connection: {
      type: Schema.Types.ObjectId,
      ref: "Connection",
      required: true,
      index: true
    },
    sender: {
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
    clientMessageId: {
      type: String,
      trim: true,
      minlength: 8,
      maxlength: 64
    },
    text: {
      type: String,
      trim: true,
      maxlength: 4000
    },
    media: {
      type: [messageMediaSchema],
      default: [],
      validate: {
        validator: (files: unknown[]) => files.length <= MAX_FILES_PER_MESSAGE,
        message: `A message can include at most ${MAX_FILES_PER_MESSAGE} files.`
      }
    },
    kind: {
      type: String,
      enum: ["text", "media", "mixed"],
      required: true,
      index: true
    },
    reactions: {
      type: [reactionSchema],
      default: []
    },
    receipts: {
      type: [readReceiptSchema],
      default: []
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true
    },
    editedAt: {
      type: Date
    },
    deletedAt: {
      type: Date
    },
    deletedBy: {
      type: Schema.Types.ObjectId,
      ref: "User"
    },
    cloudinaryDestroyedAt: {
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

messageSchema.index({ connection: 1, createdAt: -1 });
messageSchema.index({ sender: 1, recipient: 1, createdAt: -1 });
messageSchema.index(
  { sender: 1, clientMessageId: 1 },
  {
    unique: true,
    partialFilterExpression: { clientMessageId: { $type: "string" } }
  }
);
messageSchema.index({ isDeleted: 1, createdAt: -1 });
messageSchema.index({ text: "text" });

messageSchema.pre("validate", function normalizeKindAndPayload(next) {
  try {
    const hasText = Boolean(this.text?.trim());
    const hasMedia = this.media.length > 0;

    if (!this.isDeleted && !hasText && !hasMedia) {
      throw new Error("A message must include text, media, or both.");
    }

    if (hasText && hasMedia) {
      this.kind = "mixed";
    } else if (hasMedia) {
      this.kind = "media";
    } else {
      this.kind = "text";
    }

    if (this.sender?.equals?.(this.recipient)) {
      throw new Error("A message sender and recipient must be different users.");
    }

    next();
  } catch (error) {
    next(error as Error);
  }
});

export type MessageDocument = HydratedDocument<Message>;

export const MessageModel = model<Message>("Message", messageSchema);
