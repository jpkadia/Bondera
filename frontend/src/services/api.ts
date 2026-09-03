import { API_URL } from "@/config";
import type { GoogleCredential } from "@/components/GoogleAuthButton.types";
import type {
  AiConversation,
  ApiEnvelope,
  ApiErrorPayload,
  AuthTokens,
  Category,
  ChatMessage,
  Connection,
  PrivateAiReply,
  PremiumRequestState,
  PremiumRequestSummary,
  Session,
  User,
} from "@/types/api";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly code = "REQUEST_FAILED",
    public readonly status = 500,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

let activeTokens: AuthTokens | null = null;
let sessionUpdated: ((session: Session) => void) | null = null;
let refreshInFlight: Promise<boolean> | null = null;

export function configureApi(
  tokens: AuthTokens | null,
  onSessionUpdated?: (session: Session) => void,
) {
  activeTokens = tokens;
  sessionUpdated = onSessionUpdated ?? null;
}

export interface SignupDetails {
  fullName: string;
  username: string;
  email: string;
  password: string;
  birthDate: string;
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (response.status === 204) return undefined as T;
  const payload = (await response.json().catch(() => null)) as
    | ApiEnvelope<T>
    | ApiErrorPayload
    | null;
  if (!response.ok || !payload || payload.success === false) {
    const error = payload && payload.success === false ? payload : undefined;
    throw new ApiError(
      error?.message ?? "Bondera could not complete this request.",
      error?.code,
      response.status,
      error?.details,
    );
  }
  return payload.data;
}

async function refreshAccessToken(): Promise<boolean> {
  if (!activeTokens?.refreshToken) return false;
  if (refreshInFlight) return refreshInFlight;

  const refreshToken = activeTokens.refreshToken;
  refreshInFlight = (async () => {
    const response = await fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
    if (!response.ok) return false;
    const data = await parseResponse<Session>(response);
    activeTokens = data.tokens;
    sessionUpdated?.(data);
    return true;
  })().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

async function request<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const headers = new Headers(init.headers);
  if (!(init.body instanceof FormData)) headers.set("Content-Type", "application/json");
  if (activeTokens?.accessToken) {
    headers.set("Authorization", `Bearer ${activeTokens.accessToken}`);
  }
  const response = await fetch(`${API_URL}${path}`, { ...init, headers });
  if (response.status === 401 && retry && (await refreshAccessToken())) {
    return request<T>(path, init, false);
  }
  return parseResponse<T>(response);
}

export const api = {
  me: () => request<{ user: User }>("/users/me").then((data) => data.user),
  requestSignupOtp: (details: SignupDetails) =>
    request<{ expiresAt: string; retryAfterSeconds: number }>("/auth/signup/request-otp", {
      method: "POST",
      body: JSON.stringify({
        ...details,
        fullName: details.fullName?.trim() || undefined,
        username: details.username.trim().toLowerCase(),
        email: details.email.trim().toLowerCase(),
      }),
    }, false),
  verifySignup: (details: SignupDetails, otp: string) =>
    request<Session>("/auth/signup/verify", {
      method: "POST",
      body: JSON.stringify({
        ...details,
        fullName: details.fullName?.trim() || undefined,
        username: details.username.trim().toLowerCase(),
        email: details.email.trim().toLowerCase(),
        otp: otp.trim(),
      }),
    }, false),
  login: (identifier: string, password: string) =>
    request<Session>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ identifier: identifier.trim().toLowerCase(), password }),
    }),
  googleLogin: (credential: GoogleCredential) =>
    request<Session>("/auth/google/token", {
      method: "POST",
      body: JSON.stringify(credential),
    }, false),
  requestPasswordResetOtp: (identifier: string) =>
    request<{ expiresAt: string; retryAfterSeconds: number }>(
      "/auth/password/forgot/request-otp",
      {
        method: "POST",
        body: JSON.stringify({ identifier: identifier.trim().toLowerCase() }),
      },
      false,
    ),
  verifyPasswordResetOtp: (identifier: string, otp: string) =>
    request<{ resetToken: string; expiresAt: string }>(
      "/auth/password/forgot/verify-otp",
      {
        method: "POST",
        body: JSON.stringify({
          identifier: identifier.trim().toLowerCase(),
          otp: otp.trim(),
        }),
      },
      false,
    ),
  resetPassword: (resetToken: string, password: string) =>
    request<void>("/auth/password/forgot/reset", {
      method: "POST",
      body: JSON.stringify({ resetToken, password }),
    }, false),
  refresh: (refreshToken: string) =>
    request<Session>("/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refreshToken }),
    }, false),
  updateProfile: (input: {
    fullName: string;
    username: string;
    birthDate?: string;
  }) =>
    request<{ user: User }>("/users/me/profile", {
      method: "PATCH",
      body: JSON.stringify({
        fullName: input.fullName.trim(),
        username: input.username.trim().toLowerCase(),
        ...(input.birthDate ? { birthDate: input.birthDate } : {}),
      }),
    }).then((data) => data.user),
  completeBirthDate: (birthDate: string) =>
    request<{ user: User }>("/users/me/profile", {
      method: "PATCH",
      body: JSON.stringify({ birthDate }),
    }).then((data) => data.user),
  syncDeviceContext: (input: {
    timeZone: string;
    expoPushToken?: string;
    platform?: "android" | "ios";
  }) => request<{ user: User }>("/users/me/device-context", {
    method: "PUT",
    body: JSON.stringify(input),
  }).then((data) => data.user),
  unregisterDevice: (expoPushToken: string) =>
    request<void>("/users/me/device-context", {
      method: "DELETE",
      body: JSON.stringify({ expoPushToken }),
    }),
  premiumRequest: () =>
    request<PremiumRequestSummary>("/users/me/premium-request"),
  requestPremium: () =>
    request<{ request: PremiumRequestState }>("/users/me/premium-request", {
      method: "POST",
    }),
  requestEmailChange: (email: string) =>
    request<{ expiresAt: string; retryAfterSeconds: number }>("/users/me/email/request-otp", {
      method: "POST",
      body: JSON.stringify({ email: email.trim().toLowerCase() }),
    }),
  verifyEmailChange: (email: string, otp: string) =>
    request<{ user: User }>("/users/me/email/verify", {
      method: "POST",
      body: JSON.stringify({
        email: email.trim().toLowerCase(),
        otp: otp.trim(),
      }),
    }).then((data) => data.user),
  contacts: () => request<{
    categories: Record<Category, Connection[]>;
    uncategorized: Connection[];
  }>("/connections"),
  requests: () => request<{ incoming: Connection[]; outgoing: Connection[] }>(
    "/connections/requests",
  ),
  sendRequest: (uniqueId: string) => request<{ connection: Connection }>(
    "/connections/requests",
    { method: "POST", body: JSON.stringify({ uniqueId }) },
  ),
  acceptRequest: (connectionId: string, category: Category) =>
    request<{ connection: Connection }>(`/connections/${connectionId}/accept`, {
      method: "POST",
      body: JSON.stringify({ category }),
    }),
  rejectRequest: (connectionId: string) =>
    request<void>(`/connections/${connectionId}/reject`, { method: "POST" }),
  setCategory: (connectionId: string, category: Category) =>
    request<{ connection: Connection }>(`/connections/${connectionId}/category`, {
      method: "PATCH",
      body: JSON.stringify({ category }),
    }),
  removeConnection: (connectionId: string) =>
    request<void>(`/connections/${connectionId}`, { method: "DELETE" }),
  messages: (
    connectionId: string,
    cursor?: { before?: string; after?: string },
  ) =>
    request<{
      connection: Connection;
      messages: ChatMessage[];
      firstUnreadMessageId: string | null;
      nextCursor: string | null;
      nextAfterCursor: string | null;
    }>(
      `/messages/connections/${connectionId}?limit=100${
        cursor?.before ? `&before=${encodeURIComponent(cursor.before)}` : ""
      }${cursor?.after ? `&after=${encodeURIComponent(cursor.after)}` : ""}`,
    ),
  editMessage: (messageId: string, text: string) => request<{ message: ChatMessage }>(
    `/messages/${messageId}`,
    { method: "PATCH", body: JSON.stringify({ text }) },
  ),
  unsend: (messageId: string) => request<{ messageId: string; mediaCleanupPending: boolean }>(
    `/messages/${messageId}`,
    { method: "DELETE" },
  ),
  uploadMedia: (form: FormData) => request<{ message: ChatMessage }>("/media/chat", {
    method: "POST",
    body: form,
  }),
  uploadProfilePicture: (form: FormData) =>
    request<{ user: User; previousCleanupPending: boolean }>(
      "/media/profile-picture",
      { method: "POST", body: form },
    ),
  removeProfilePicture: () =>
    request<{ user: User; cleanupPending: boolean }>(
      "/media/profile-picture",
      { method: "DELETE" },
    ),
  aiConversations: () =>
    request<{ conversations: AiConversation[] }>("/ai/conversations"),
  deleteAiConversation: (conversationId: string) =>
    request<{ conversationId: string }>(`/ai/conversations/${conversationId}`, {
      method: "DELETE",
    }),
  askPrivateAi: (question: string, conversationId?: string) =>
    request<PrivateAiReply>("/ai/chat", {
      method: "POST",
      body: JSON.stringify({
        question: question.trim(),
        ...(conversationId ? { conversationId } : {}),
      }),
    }),
};
