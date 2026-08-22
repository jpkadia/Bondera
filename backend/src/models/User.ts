import bcrypt from "bcryptjs";
import mongoose, {
  type HydratedDocument,
  Schema,
  model
} from "mongoose";
import { USERNAME_PATTERN } from "../constants/auth";
import { generateUniqueId } from "../utils/generateUniqueId";

const profilePictureSchema = new Schema(
  {
    url: {
      type: String,
      trim: true
    },
    publicId: {
      type: String,
      trim: true
    }
  },
  { _id: false }
);

const userSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      index: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Email address is invalid."]
    },
    username: {
      type: String,
      required: true,
      unique: true,
      index: true,
      lowercase: true,
      trim: true,
      minlength: 3,
      maxlength: 30,
      match: [
        USERNAME_PATTERN,
        "Username may use lowercase letters, numbers, periods, and underscores and must start and end with a letter or number."
      ]
    },
    fullName: {
      type: String,
      trim: true,
      maxlength: 80
    },
    passwordHash: {
      type: String,
      select: false
    },
    googleId: {
      type: String,
      unique: true,
      sparse: true,
      select: false,
      trim: true
    },
    authProviders: {
      type: [String],
      enum: ["email", "google"],
      default: ["email"],
      validate: {
        validator: (providers: string[]) => providers.length > 0,
        message: "At least one authentication provider is required."
      }
    },
    uniqueId: {
      type: String,
      unique: true,
      index: true,
      uppercase: true,
      trim: true,
      immutable: true,
      minlength: 10,
      maxlength: 10,
      match: [/^[A-Z0-9]{10}$/, "Unique ID must be exactly 10 uppercase letters or numbers."]
    },
    profilePicture: profilePictureSchema,
    bio: {
      type: String,
      trim: true,
      maxlength: 160
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
      index: true
    },
    isPremium: {
      type: Boolean,
      default: false,
      index: true
    },
    status: {
      type: String,
      enum: ["active", "suspended", "deleted"],
      default: "active",
      index: true
    },
    lastSeenAt: {
      type: Date
    }
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret) => {
        delete ret.passwordHash;
        delete ret.googleId;
        return ret;
      }
    },
    toObject: {
      virtuals: true
    }
  }
);

userSchema.index({ email: 1, status: 1 });
userSchema.index({ username: 1, status: 1 });

userSchema.virtual("id").get(function getId() {
  return this._id.toString();
});

userSchema.pre("validate", async function assignUniqueId(next) {
  try {
    if (!this.uniqueId) {
      const UserModel = mongoose.model<UserDocument>("User");

      for (let attempt = 0; attempt < 20; attempt += 1) {
        const candidate = generateUniqueId();
        const existingUser = await UserModel.exists({ uniqueId: candidate });

        if (!existingUser) {
          this.uniqueId = candidate;
          break;
        }
      }

      if (!this.uniqueId) {
        throw new Error("Unable to generate a unique Bondera user ID.");
      }
    }

    next();
  } catch (error) {
    next(error as Error);
  }
});

userSchema.methods.comparePassword = async function comparePassword(
  password: string
): Promise<boolean> {
  if (!this.passwordHash) {
    return false;
  }

  return bcrypt.compare(password, this.passwordHash);
};

export interface User {
  email: string;
  username: string;
  fullName?: string;
  passwordHash?: string;
  googleId?: string;
  authProviders: Array<"email" | "google">;
  uniqueId: string;
  profilePicture?: {
    url?: string;
    publicId?: string;
  };
  bio?: string;
  isEmailVerified: boolean;
  isPremium: boolean;
  status: "active" | "suspended" | "deleted";
  lastSeenAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserMethods {
  comparePassword(password: string): Promise<boolean>;
}

export type UserDocument = HydratedDocument<User, UserMethods>;

export const UserModel = model<User, mongoose.Model<User, object, UserMethods>>(
  "User",
  userSchema
);
