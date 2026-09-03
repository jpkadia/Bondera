import { io, type Socket } from "socket.io-client";

import { SOCKET_URL } from "@/config";
import type { ChatMessage, MessageReaction, ReactionEvent } from "@/types/api";

export interface RealtimeConnectionState {
  recovered: boolean;
  reconnected: boolean;
}

export interface RealtimeEvents {
  onConnect?(state: RealtimeConnectionState): void;
  onConnectError?(error: Error): void;
  onDisconnect?(): void;
  onAccountBirthday?(payload: { title: string; body: string }): void;
  onConnectionsChanged?(payload: { connectionId: string; reason: string }): void;
  onMessage?(message: ChatMessage): void;
  onEdited?(message: ChatMessage): void;
  onDelivered?(payload: { messageIds: string[]; deliveredAt: string }): void;
  onSeen?(payload: { messageIds: string[]; seenAt: string }): void;
  onUnreadCount?(payload: { connectionId: string; unreadCount: number }): void;
  onReaction?(payload: ReactionEvent): void;
  onUnsent?(payload: { messageId: string; deletedAt: string }): void;
  onTyping?(userId: string, typing: boolean): void;
}

type Ack<T> =
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string } };

const CONNECT_WAIT_TIMEOUT_MS = 20_000;
const ACK_TIMEOUT_MS = 10_000;

export class RealtimeClient {
  private socket: Socket | null = null;
  private token: string | null = null;
  private hasConnected = false;
  private appActive = true;
  private readonly subscribers = new Set<RealtimeEvents>();

  connect(token: string): void {
    if (this.socket && this.token === token) return;

    this.disconnect();
    this.token = token;
    this.hasConnected = false;
    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ["websocket", "polling"],
      rememberUpgrade: true,
      reconnection: true,
      reconnectionDelay: 500,
      reconnectionDelayMax: 5_000,
      randomizationFactor: 0.5,
      timeout: 20_000,
    });
    this.socket = socket;

    socket.on("connect", () => {
      const state = {
        recovered: socket.recovered,
        reconnected: this.hasConnected,
      };
      this.hasConnected = true;
      socket.emit("presence:update", { active: this.appActive });
      this.notify((subscriber) => subscriber.onConnect?.(state));
    });
    socket.on("disconnect", () =>
      this.notify((subscriber) => subscriber.onDisconnect?.()),
    );
    socket.on("connect_error", (error) =>
      this.notify((subscriber) => subscriber.onConnectError?.(error)),
    );
    socket.on("account:birthday", (payload) =>
      this.notify((subscriber) => subscriber.onAccountBirthday?.(payload)),
    );
    socket.on("connections:changed", (payload) =>
      this.notify((subscriber) => subscriber.onConnectionsChanged?.(payload)),
    );
    socket.on("message:new", (message) =>
      this.notify((subscriber) => subscriber.onMessage?.(message)),
    );
    socket.on("message:edited", (message) =>
      this.notify((subscriber) => subscriber.onEdited?.(message)),
    );
    socket.on("messages:delivered", (payload) =>
      this.notify((subscriber) => subscriber.onDelivered?.(payload)),
    );
    socket.on("messages:seen", (payload) =>
      this.notify((subscriber) => subscriber.onSeen?.(payload)),
    );
    socket.on("connection:unread", (payload) =>
      this.notify((subscriber) => subscriber.onUnreadCount?.(payload)),
    );
    socket.on("message:reaction", (payload) =>
      this.notify((subscriber) => subscriber.onReaction?.(payload)),
    );
    socket.on("message:unsent", (payload) =>
      this.notify((subscriber) => subscriber.onUnsent?.(payload)),
    );
    socket.on("typing:start", ({ userId }) =>
      this.notify((subscriber) => subscriber.onTyping?.(userId, true)),
    );
    socket.on("typing:stop", ({ userId }) =>
      this.notify((subscriber) => subscriber.onTyping?.(userId, false)),
    );
  }

  subscribe(events: RealtimeEvents): () => void {
    this.subscribers.add(events);
    if (this.socket?.connected) {
      queueMicrotask(() => {
        if (this.subscribers.has(events)) {
          events.onConnect?.({ recovered: true, reconnected: false });
        }
      });
    }
    return () => {
      this.subscribers.delete(events);
    };
  }

  disconnect(): void {
    this.socket?.removeAllListeners();
    this.socket?.disconnect();
    this.socket = null;
    this.token = null;
    this.hasConnected = false;
  }

  private notify(invoke: (subscriber: RealtimeEvents) => void): void {
    for (const subscriber of this.subscribers) {
      invoke(subscriber);
    }
  }

  private waitForConnection(timeoutMs = CONNECT_WAIT_TIMEOUT_MS): Promise<void> {
    const socket = this.socket;
    if (!socket) return Promise.reject(new Error("Realtime connection is unavailable."));
    if (socket.connected) return Promise.resolve();

    return new Promise((resolve, reject) => {
      const cleanup = () => {
        clearTimeout(timer);
        socket.off("connect", connected);
        socket.off("connect_error", failed);
      };
      const connected = () => {
        cleanup();
        resolve();
      };
      const failed = () => {
        cleanup();
        reject(new Error("Realtime connection failed."));
      };
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error("Realtime connection timed out."));
      }, timeoutMs);
      socket.once("connect", connected);
      socket.once("connect_error", failed);
    });
  }

  private async emit<T>(event: string, payload: unknown): Promise<T> {
    await this.waitForConnection();
    const socket = this.socket;
    if (!socket?.connected) throw new Error("Realtime connection is unavailable.");

    return new Promise((resolve, reject) => {
      socket.timeout(ACK_TIMEOUT_MS).emit(
        event,
        payload,
        (timeout: Error | null, ack: Ack<T>) => {
          if (timeout) reject(new Error("Realtime request timed out."));
          else if (!ack?.success) {
            reject(new Error(ack?.error.message ?? "Realtime request failed."));
          } else resolve(ack.data);
        },
      );
    });
  }

  async sendMessage(payload: {
    recipientId: string;
    text: string;
    clientMessageId: string;
  }) {
    let lastError: unknown;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const result = await this.emit<{ message: ChatMessage }>(
          "message:send",
          payload,
        );
        this.notify((subscriber) => subscriber.onMessage?.(result.message));
        return result;
      } catch (error) {
        lastError = error;
        if (attempt < 2) {
          await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
        }
      }
    }
    throw lastError instanceof Error ? lastError : new Error("Message could not be sent.");
  }

  markSeen(messageId: string) {
    return this.emit<{ messageIds: string[]; seenAt?: string }>(
      "message:seen",
      { messageId },
    );
  }

  react(messageId: string, emoji: string) {
    return this.emit<{ messageId: string; reactions: MessageReaction[] }>(
      "message:react",
      { messageId, emoji },
    );
  }

  typing(recipientId: string, active: boolean): void {
    this.socket?.volatile.emit(
      active ? "typing:start" : "typing:stop",
      { recipientId },
    );
  }

  setPresence(active: boolean): void {
    this.appActive = active;
    this.socket?.emit("presence:update", { active });
  }
}
