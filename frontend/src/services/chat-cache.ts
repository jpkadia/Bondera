import type { ChatMessage, Connection } from "../types/api";

export interface ChatSnapshot {
  connection: Connection;
  messages: ChatMessage[];
  firstUnreadMessageId: string | null;
  nextAfterCursor: string | null;
}

const MAX_CACHED_CHATS = 12;
const MAX_CACHED_MESSAGES = 150;
const snapshots = new Map<string, ChatSnapshot>();

export function getChatSnapshot(connectionId: string): ChatSnapshot | undefined {
  const snapshot = snapshots.get(connectionId);
  if (!snapshot) return undefined;
  snapshots.delete(connectionId);
  snapshots.set(connectionId, snapshot);
  return snapshot;
}

export function setChatSnapshot(
  connectionId: string,
  snapshot: ChatSnapshot,
): void {
  snapshots.delete(connectionId);
  snapshots.set(connectionId, {
    ...snapshot,
    messages: snapshot.messages
      .filter((message) => !message.pending)
      .slice(-MAX_CACHED_MESSAGES),
  });

  while (snapshots.size > MAX_CACHED_CHATS) {
    const oldest = snapshots.keys().next().value as string | undefined;
    if (!oldest) break;
    snapshots.delete(oldest);
  }
}

export function clearChatSnapshots(): void {
  snapshots.clear();
}
