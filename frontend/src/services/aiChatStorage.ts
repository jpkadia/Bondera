import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

export interface StoredAiTurn {
  id: string;
  question: string;
  answer: string;
  textMessagesAnalyzed: number;
  historyTruncated: boolean;
}

export interface StoredAiConversation {
  id: string;
  title: string;
  turns: StoredAiTurn[];
  createdAt: string;
  updatedAt: string;
}

const STORAGE_KEY = "bondera.private-ai.chats.v1";

const webStorage = () =>
  typeof globalThis.localStorage === "undefined" ? undefined : globalThis.localStorage;

export async function loadAiConversations(): Promise<StoredAiConversation[]> {
  try {
    const serialized = Platform.OS === "web"
      ? webStorage()?.getItem(STORAGE_KEY)
      : await SecureStore.getItemAsync(STORAGE_KEY);
    return serialized ? (JSON.parse(serialized) as StoredAiConversation[]) : [];
  } catch {
    return [];
  }
}

export async function saveAiConversations(conversations: StoredAiConversation[]): Promise<void> {
  const serialized = JSON.stringify(conversations.slice(0, 50));
  if (Platform.OS === "web") {
    webStorage()?.setItem(STORAGE_KEY, serialized);
    return;
  }
  await SecureStore.setItemAsync(STORAGE_KEY, serialized, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

export async function deleteAiConversation(conversationId: string): Promise<StoredAiConversation[]> {
  const existing = await loadAiConversations();
  const next = existing.filter((item) => item.id !== conversationId);
  await saveAiConversations(next);
  return next;
}

