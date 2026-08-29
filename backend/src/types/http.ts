import type { Request } from "express";
import type { Types } from "mongoose";

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    mongoId: Types.ObjectId;
    email: string;
    username: string;
    uniqueId: string;
    birthDate?: string;
    isPremium: boolean;
  };
}

export interface AuthenticatedAdminRequest extends Request {
  admin?: {
    email: string;
    csrfToken: string;
  };
}
