import type {
  StoredAiConversation,
  StoredAiTurn,
} from "./aiChatStorage";

export interface AiChatSnapshot {
  conversations: StoredAiConversation[];
  activeConversationId: string | null;
  turns: StoredAiTurn[];
  cachedAt: number;
}

export const AI_CHAT_CACHE_TTL_MS = 5 * 60 * 1000;

const snapshots = new Map<string, AiChatSnapshot>();

export function getAiChatSnapshot(key: string): AiChatSnapshot | undefined {
  return snapshots.get(key);
}

export function isAiChatSnapshotFresh(
  snapshot: AiChatSnapshot,
  now = Date.now(),
): boolean {
  return now - snapshot.cachedAt < AI_CHAT_CACHE_TTL_MS;
}

export function setAiChatSnapshot(
  key: string,
  snapshot: Omit<AiChatSnapshot, "cachedAt">,
  now = Date.now(),
): void {
  snapshots.set(key, { ...snapshot, cachedAt: now });
}

export function clearAiChatSnapshots(): void {
  snapshots.clear();
}
