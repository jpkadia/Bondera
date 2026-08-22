import React, { createContext, useContext, useEffect, useState } from "react";
import {
  InAppNotificationToast,
  type InAppNotificationPayload,
} from "@/components/InAppNotificationToast";
import {
  requestNotificationPermission,
  showDeviceNotification,
} from "@/services/notification";
import type { ChatMessage } from "@/types/api";

interface NotificationContextValue {
  showNotification: (message: ChatMessage, senderName?: string) => void;
  requestPermission: () => Promise<boolean>;
}

const NotificationContext = createContext<NotificationContextValue>({
  showNotification: () => undefined,
  requestPermission: async () => false,
});

export const useNotification = () => useContext(NotificationContext);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [currentNotification, setCurrentNotification] =
    useState<InAppNotificationPayload | null>(null);

  useEffect(() => {
    void requestNotificationPermission();
  }, []);

  const showNotification = (message: ChatMessage, senderName?: string) => {
    const title = senderName ? `${senderName}` : "New message on Bondera";
    const body =
      message.text ||
      (message.media?.length
        ? `Sent ${message.media.length} media file(s)`
        : "New message");

    // 1. Device notification (Web Notification / System)
    showDeviceNotification(title, {
      body,
      tag: message.connectionId,
    });

    // 2. In-App Toast notification
    setCurrentNotification({
      message,
      senderName,
    });
  };

  const requestPermission = async () => {
    return requestNotificationPermission();
  };

  return (
    <NotificationContext.Provider value={{ showNotification, requestPermission }}>
      {children}
      <InAppNotificationToast
        notification={currentNotification}
        onDismiss={() => setCurrentNotification(null)}
      />
    </NotificationContext.Provider>
  );
}
