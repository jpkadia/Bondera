import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const STORAGE_KEY = "bondera.media.downloaded.v1";

const webStorage = () =>
  typeof globalThis.localStorage === "undefined" ? undefined : globalThis.localStorage;

let memoryCache: Set<string> | null = null;

export async function loadDownloadedMediaKeys(): Promise<Set<string>> {
  if (memoryCache) return memoryCache;
  try {
    const serialized =
      Platform.OS === "web"
        ? webStorage()?.getItem(STORAGE_KEY)
        : await SecureStore.getItemAsync(STORAGE_KEY);
    const parsed: string[] = serialized ? JSON.parse(serialized) : [];
    memoryCache = new Set(parsed);
    return memoryCache;
  } catch {
    memoryCache = new Set();
    return memoryCache;
  }
}

export function isMediaDownloadedSync(mediaKey: string): boolean {
  return memoryCache?.has(mediaKey) ?? false;
}

export async function setMediaDownloaded(mediaKey: string, downloaded: boolean): Promise<void> {
  const keys = await loadDownloadedMediaKeys();
  if (downloaded) {
    keys.add(mediaKey);
  } else {
    keys.delete(mediaKey);
  }
  memoryCache = keys;
  const serialized = JSON.stringify(Array.from(keys));
  try {
    if (Platform.OS === "web") {
      webStorage()?.setItem(STORAGE_KEY, serialized);
    } else {
      await SecureStore.setItemAsync(STORAGE_KEY, serialized);
    }
  } catch {
    // Ignore storage quota errors
  }
}

export async function triggerDeviceDownload(url: string, fileName: string): Promise<void> {
  if (Platform.OS === "web") {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => window.URL.revokeObjectURL(blobUrl), 15000);
    } catch {
      // Fallback for cross-origin or direct navigation
      const link = document.createElement("a");
      link.href = url;
      link.target = "_blank";
      link.download = fileName;
      link.rel = "noopener noreferrer";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }
}
