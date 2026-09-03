import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AppState, Platform } from "react-native";
import {
  InAppNotificationToast,
  type InAppNotificationPayload,
} from "@/components/InAppNotificationToast";
import {
  requestNotificationPermission,
  showDeviceNotification,
} from "@/services/notification";
import { useRealtime } from "@/context/RealtimeContext";
import { useAuth } from "@/context/AuthContext";
import type { ChatMessage, ReactionNotification } from "@/types/api";

interface NotificationContextValue {
  showNotification: (message: ChatMessage, senderName?: string) => boolean;
  showReactionNotification: (reaction: ReactionNotification) => boolean;
  showAccountNotification: (title: string, body: string) => void;
  requestPermission: () => Promise<boolean>;
  setActiveConnection: (connectionId: string) => void;
  clearActiveConnection: (connectionId: string) => void;
  isConnectionVisible: (connectionId: string) => boolean;
}

const NotificationContext = createContext<NotificationContextValue>({
  showNotification: () => false,
  showReactionNotification: () => false,
  showAccountNotification: () => undefined,
  requestPermission: async () => false,
  setActiveConnection: () => undefined,
  clearActiveConnection: () => undefined,
  isConnectionVisible: () => false,
});

export const useNotification = () => useContext(NotificationContext);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { subscribe } = useRealtime();
  const [currentNotification, setCurrentNotification] =
    useState<InAppNotificationPayload | null>(null);
  const activeConnectionId = useRef<string | null>(null);
  const appIsActive = useRef(AppState.currentState === "active");
  const documentIsVisible = useRef(
    Platform.OS !== "web" ||
      typeof document === "undefined" ||
      document.visibilityState === "visible",
  );

  useEffect(() => {
    void requestNotificationPermission();
  }, []);

  useEffect(() => {
    const appStateSubscription = AppState.addEventListener("change", (state) => {
      appIsActive.current = state === "active";
    });
    const handleDocumentVisibility = () => {
      documentIsVisible.current = document.visibilityState === "visible";
    };

    if (Platform.OS === "web" && typeof document !== "undefined") {
      document.addEventListener("visibilitychange", handleDocumentVisibility);
    }

    return () => {
      appStateSubscription.remove();
      if (Platform.OS === "web" && typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", handleDocumentVisibility);
      }
    };
  }, []);

  const setActiveConnection = useCallback((connectionId: string) => {
    activeConnectionId.current = connectionId;
  }, []);

  const clearActiveConnection = useCallback((connectionId: string) => {
    if (activeConnectionId.current === connectionId) {
      activeConnectionId.current = null;
    }
  }, []);

  const isConnectionVisible = useCallback(
    (connectionId: string) =>
      activeConnectionId.current === connectionId &&
      appIsActive.current &&
      documentIsVisible.current,
    [],
  );

  const isInterfaceVisible = useCallback(
    () => appIsActive.current && documentIsVisible.current,
    [],
  );

  const showNotification = useCallback((message: ChatMessage, senderName?: string) => {
    if (isConnectionVisible(message.connectionId)) return false;

    const title = senderName || message.senderName || "New message on Bondera";
    const body =
      message.text ||
      (message.media?.length
        ? `Sent ${message.media.length} media file(s)`
        : "New message");

    if (isInterfaceVisible()) {
      setCurrentNotification({ type: "message", message, senderName });
    } else {
      showDeviceNotification(title, { body, tag: message.connectionId });
    }
    return true;
  }, [isConnectionVisible, isInterfaceVisible]);

  const showAccountNotification = useCallback((title: string, body: string) => {
    if (isInterfaceVisible()) {
      setCurrentNotification({ type: "account", title, body });
    } else {
      showDeviceNotification(title, { body, tag: "account-birthday" });
    }
  }, [isInterfaceVisible]);

  const showReactionNotification = useCallback(
    (reaction: ReactionNotification) => {
      if (isConnectionVisible(reaction.connectionId)) return false;

      const title = `${reaction.reactorName} reacted to your message`;
      const body = `${reaction.emoji} ${reaction.messagePreview}`;
      if (isInterfaceVisible()) {
        setCurrentNotification({ type: "reaction", reaction });
      } else {
        showDeviceNotification(title, {
          body,
          tag: `reaction:${reaction.messageId}`,
        });
      }
      return true;
    },
    [isConnectionVisible, isInterfaceVisible],
  );

  const requestPermission = useCallback(async () => {
    return requestNotificationPermission();
  }, []);

  useEffect(
    () =>
      subscribe({
        onAccountBirthday: ({ title, body }) =>
          showAccountNotification(title, body),
        onMessage: (message) => {
          if (message.senderId !== user?.id) showNotification(message);
        },
        onReaction: ({ notification }) => {
          if (notification) showReactionNotification(notification);
        },
      }),
    [
      showAccountNotification,
      showNotification,
      showReactionNotification,
      subscribe,
      user?.id,
    ],
  );

  const value = useMemo(
    () => ({
      showNotification,
      showReactionNotification,
      showAccountNotification,
      requestPermission,
      setActiveConnection,
      clearActiveConnection,
      isConnectionVisible,
    }),
    [
      clearActiveConnection,
      isConnectionVisible,
      requestPermission,
      setActiveConnection,
      showNotification,
      showReactionNotification,
      showAccountNotification,
    ],
  );

  return (
    <NotificationContext.Provider value={value}>
      {children}
      <InAppNotificationToast
        notification={currentNotification}
        onDismiss={() => setCurrentNotification(null)}
      />
    </NotificationContext.Provider>
  );
}
