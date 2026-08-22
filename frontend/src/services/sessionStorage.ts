import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

import type { Session } from "@/types/api";

const SESSION_KEY = "bondera.session.v1";
const webStorage = () =>
  typeof globalThis.localStorage === "undefined" ? undefined : globalThis.localStorage;

export async function loadSession(): Promise<Session | null> {
  try {
    const serialized = Platform.OS === "web"
      ? webStorage()?.getItem(SESSION_KEY)
      : await SecureStore.getItemAsync(SESSION_KEY);
    return serialized ? (JSON.parse(serialized) as Session) : null;
  } catch {
    return null;
  }
}

export async function saveSession(session: Session): Promise<void> {
  const serialized = JSON.stringify(session);
  if (Platform.OS === "web") {
    webStorage()?.setItem(SESSION_KEY, serialized);
    return;
  }
  await SecureStore.setItemAsync(SESSION_KEY, serialized, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

export async function clearSession(): Promise<void> {
  if (Platform.OS === "web") {
    webStorage()?.removeItem(SESSION_KEY);
    return;
  }
  await SecureStore.deleteItemAsync(SESSION_KEY);
}
