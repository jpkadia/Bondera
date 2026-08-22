export type Category = "Family" | "Friends" | "Professional";

export interface ProfilePicture { url?: string }

export interface User {
  id: string;
  email: string;
  username: string;
  fullName?: string;
  uniqueId: string;
  profilePicture?: ProfilePicture;
  bio?: string;
  isPremium: boolean;
}

export interface AuthTokens {
  tokenType: "Bearer";
  accessToken: string;
  refreshToken: string;
}

export interface Session { user: User; tokens: AuthTokens }

export interface PublicUser {
  id: string;
  username: string;
  fullName?: string;
  uniqueId: string;
  profilePicture?: ProfilePicture;
}

export interface Connection {
  id: string;
  status: "pending" | "accepted" | "rejected" | "removed";
  direction: "incoming" | "outgoing";
  category?: Category;
  chatEnabled: boolean;
  awaitingYourCategory: boolean;
  awaitingOtherCategory: boolean;
  requestedAt: string;
  respondedAt?: string;
  lastMessageAt?: string;
  unreadCount: number;
  otherUser: PublicUser;
}

export interface MessageMedia {
  id?: string;
  url: string;
  resourceType: "image" | "video" | "raw" | "auto";
  format?: string;
  originalName?: string;
  mimeType: string;
  bytes: number;
  width?: number;
  height?: number;
  durationSeconds?: number;
}

export interface MessageReaction { userId: string; emoji: string; reactedAt: string }
export interface MessageReceipt { userId: string; deliveredAt?: string; seenAt?: string }

export interface ChatMessage {
  id: string;
  connectionId: string;
  senderId: string;
  recipientId: string;
  clientMessageId?: string;
  text?: string;
  media: MessageMedia[];
  kind: "text" | "media" | "mixed";
  reactions: MessageReaction[];
  receipts: MessageReceipt[];
  isDeleted: boolean;
  editedAt?: string;
  deletedAt?: string;
  createdAt: string;
  updatedAt: string;
  pending?: boolean;
  failed?: boolean;
}

export interface PrivateAiReply {
  answer: string;
  context: {
    textMessagesAnalyzed: number;
    historyTruncated: boolean;
    generatedAt: string;
  };
}

export interface ApiEnvelope<T> { success: true; message?: string; data: T }
export interface ApiErrorPayload {
  success: false;
  code: string;
  message: string;
  details?: unknown;
}
