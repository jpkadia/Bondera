import { router } from "expo-router";
import { MessageSquare, X } from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Platform, Pressable } from "react-native";
import { styled } from "styled-components/native";

import { colors } from "@/theme";
import type { ChatMessage } from "@/types/api";

export interface InAppNotificationPayload {
  message: ChatMessage;
  senderName?: string;
  senderAvatar?: string;
}

interface InAppNotificationToastProps {
  notification: InAppNotificationPayload | null;
  onDismiss: () => void;
}

const ToastContainer = styled(Animated.View)`
  position: absolute;
  top: ${Platform.OS === "ios" ? 50 : 20}px;
  left: 16px;
  right: 16px;
  max-width: 460px;
  align-self: center;
  z-index: 99999;
`;

const ToastCard = styled(Pressable)`
  flex-direction: row;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border-radius: 12px;
  background-color: ${colors.black};
  border-width: 1px;
  border-color: ${colors.border};
  shadow-color: #000;
  shadow-offset: 0px 4px;
  shadow-opacity: 0.25;
  shadow-radius: 8px;
  elevation: 8;
`;

const IconBadge = styled.View`
  width: 38px;
  height: 38px;
  border-radius: 19px;
  align-items: center;
  justify-content: center;
  background-color: ${colors.brand};
`;

const Content = styled.View`
  flex: 1;
  min-width: 0;
  gap: 2px;
`;

const Sender = styled.Text.attrs({ numberOfLines: 1 })`
  color: ${colors.white};
  font-size: 14px;
  font-weight: 800;
`;

const Body = styled.Text.attrs({ numberOfLines: 1 })`
  color: rgba(255, 255, 255, 0.85);
  font-size: 12px;
`;

const CloseButton = styled(Pressable)`
  padding: 4px;
`;

export function InAppNotificationToast({
  notification,
  onDismiss,
}: InAppNotificationToastProps) {
  const [slideAnim] = useState(() => new Animated.Value(-100));
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleDismiss = useCallback(() => {
    Animated.timing(slideAnim, {
      toValue: -100,
      duration: 200,
      useNativeDriver: true,
    }).start(() => onDismiss());
  }, [onDismiss, slideAnim]);

  useEffect(() => {
    if (notification) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        bounciness: 6,
      }).start();

      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        handleDismiss();
      }, 5000);
    } else {
      slideAnim.setValue(-100);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [handleDismiss, notification, slideAnim]);

  const handlePress = () => {
    if (!notification) return;
    handleDismiss();
    router.push({
      pathname: "/chat/[connectionId]",
      params: {
        connectionId: notification.message.connectionId,
        userId: notification.message.senderId,
        username: notification.senderName ?? "user",
      },
    });
  };

  if (!notification) return null;

  const previewText =
    notification.message.text ||
    (notification.message.media?.length
      ? `Sent ${notification.message.media.length} media file(s)`
      : "New message");

  return (
    <ToastContainer style={{ transform: [{ translateY: slideAnim }] }}>
      <ToastCard onPress={handlePress}>
        <IconBadge>
          <MessageSquare size={18} color={colors.white} />
        </IconBadge>
        <Content>
          <Sender>{notification.senderName || "New message"}</Sender>
          <Body>{previewText}</Body>
        </Content>
        <CloseButton onPress={handleDismiss} hitSlop={10}>
          <X size={16} color="rgba(255, 255, 255, 0.7)" />
        </CloseButton>
      </ToastCard>
    </ToastContainer>
  );
}
