import { io, type Socket } from "socket.io-client";

import { SOCKET_URL } from "@/config";
import type { ChatMessage, MessageReaction, ReactionEvent } from "@/types/api";

export interface RealtimeEvents {
  onConnect?(): void;
  onDisconnect?(): void;
  onAccountBirthday?(payload: { title: string; body: string }): void;
  onMessage(message: ChatMessage): void;
  onEdited(message: ChatMessage): void;
  onDelivered(payload: { messageIds: string[]; deliveredAt: string }): void;
  onSeen(payload: { messageIds: string[]; seenAt: string }): void;
  onUnreadCount(payload: { connectionId: string; unreadCount: number }): void;
  onReaction(payload: ReactionEvent): void;
  onUnsent(payload: { messageId: string; deletedAt: string }): void;
  onTyping(userId: string, typing: boolean): void;
}

type Ack<T> =
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string } };

export class RealtimeClient {
  private socket: Socket | null = null;

  connect(token: string, events: RealtimeEvents) {
    this.disconnect();
    this.socket = io(SOCKET_URL, { auth: { token }, transports: ["websocket", "polling"] });
    this.socket.on("connect", () => events.onConnect?.());
    this.socket.on("disconnect", () => events.onDisconnect?.());
    this.socket.on("account:birthday", (payload) => events.onAccountBirthday?.(payload));
    this.socket.on("message:new", events.onMessage);
    this.socket.on("message:edited", events.onEdited);
    this.socket.on("messages:delivered", events.onDelivered);
    this.socket.on("messages:seen", events.onSeen);
    this.socket.on("connection:unread", events.onUnreadCount);
    this.socket.on("message:reaction", events.onReaction);
    this.socket.on("message:unsent", events.onUnsent);
    this.socket.on("typing:start", ({ userId }) => events.onTyping(userId, true));
    this.socket.on("typing:stop", ({ userId }) => events.onTyping(userId, false));
  }

  disconnect() {
    this.socket?.disconnect();
    this.socket = null;
  }

  private emit<T>(event: string, payload: unknown): Promise<T> {
    return new Promise((resolve, reject) => {
      if (!this.socket?.connected) {
        reject(new Error("Realtime connection is unavailable."));
        return;
      }
      this.socket.timeout(10000).emit(event, payload, (timeout: Error | null, ack: Ack<T>) => {
        if (timeout) reject(new Error("Realtime request timed out."));
        else if (!ack?.success) reject(new Error(ack?.error.message ?? "Realtime request failed."));
        else resolve(ack.data);
      });
    });
  }

  sendMessage(payload: { recipientId: string; text: string; clientMessageId: string }) {
    return this.emit<{ message: ChatMessage }>("message:send", payload);
  }

  markSeen(messageId: string) {
    return this.emit<{ messageIds: string[]; seenAt?: string }>("message:seen", { messageId });
  }

  react(messageId: string, emoji: string) {
    return this.emit<{ messageId: string; reactions: MessageReaction[] }>(
      "message:react", { messageId, emoji },
    );
  }

  typing(recipientId: string, active: boolean) {
    this.socket?.volatile.emit(
      active ? "typing:start" : "typing:stop",
      { recipientId },
    );
  }
}
