import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import {
  Redirect,
  router,
  useFocusEffect,
  useIsFocused,
  useLocalSearchParams,
} from "expo-router";
import {
  FlashList,
  type FlashListRef,
  type ViewToken,
  useMappingHelper,
} from "@shopify/flash-list";
import {
  EmojiPicker,
  type EmojiSelection,
} from "rn-expo-emoji-picker";
import {
  ArrowLeft,
  ChevronDown,
  Edit3,
  ImagePlus,
  MoreVertical,
  Paperclip,
  Send,
  SmilePlus,
  Trash2,
  X,
} from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  TextInput as NativeTextInput,
  useWindowDimensions,
} from "react-native";
import type { NativeScrollEvent, NativeSyntheticEvent } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { styled } from "styled-components/native";

import { Avatar } from "@/components/Avatar";
import { IconButton } from "@/components/IconButton";
import { Notice } from "@/components/Notice";
import { TypingIndicator } from "@/components/TypingIndicator";
import { WhatsAppMediaCard } from "@/components/WhatsAppMediaCard";
import { useAuth } from "@/context/AuthContext";
import { useNotification } from "@/context/NotificationContext";
import { useRealtime } from "@/context/RealtimeContext";
import { demoMessages } from "@/data/demo";
import { api } from "@/services/api";
import {
  clampComposerInputHeight,
  insertTextAtSelection,
} from "@/services/chat-composer";
import { getChatSnapshot, setChatSnapshot } from "@/services/chat-cache";
import {
  canAcknowledgeSeen,
  findFirstUnreadIndex,
  latestSeenAt,
  latestViewableUnreadMessage,
} from "@/services/read-state";
import { shouldShowMessageAction } from "@/services/message-actions";
import {
  createOptimisticMessage,
  restoreOwnReaction,
  toggleOwnReaction,
} from "@/services/optimistic-chat";
import {
  REMOTE_TYPING_STALE_TIMEOUT_MS,
  TypingSignalController,
} from "@/services/typing-state";
import { colors } from "@/theme";
import type { ChatMessage, Connection, MessageReaction, PublicUser } from "@/types/api";
import {
  chatDateLabel,
  displayName,
  isSameCalendarDay,
  messageTime,
  seenReceiptLabel,
} from "@/utils/format";

const MAX_FILES = 3;
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const BOTTOM_FOLLOW_THRESHOLD_PX = 96;
const MESSAGE_VIEWABILITY_CONFIG = {
  minimumViewTime: 400,
  itemVisiblePercentThreshold: 60,
};
const MIN_COMPOSER_INPUT_HEIGHT = 34;
const MAX_COMPOSER_INPUT_HEIGHT = 104;
const REACTIONS = ["❤", "👍", "😂", "😮", "😢", "🙏"];

interface SelectedFile {
  uri: string;
  name: string;
  mimeType: string;
  size?: number;
  file?: File;
}

const Screen = styled(SafeAreaView)`
  flex: 1;
  background-color: ${colors.canvas};
`;

const Shell = styled(KeyboardAvoidingView)<{ $wide: boolean }>`
  flex: 1;
  width: 100%;
  max-width: ${({ $wide }) => ($wide ? "980px" : "100%")};
  align-self: center;
  border-left-width: ${({ $wide }) => ($wide ? 1 : 0)}px;
  border-right-width: ${({ $wide }) => ($wide ? 1 : 0)}px;
  border-color: ${colors.border};
  background-color: ${colors.surface};
`;

const Header = styled.View`
  min-height: 70px;
  flex-direction: row;
  align-items: center;
  gap: 10px;
  padding: 9px 12px;
  border-bottom-width: 1px;
  border-bottom-color: ${colors.border};
  background-color: ${colors.surface};
`;

const Person = styled.View`
  flex: 1;
  min-width: 0;
`;

const Name = styled.Text.attrs({ numberOfLines: 1 })`
  color: ${colors.ink};
  font-size: 15px;
  font-weight: 800;
`;

const Presence = styled.Text`
  color: ${colors.inkMuted};
  font-size: 12px;
`;

const Messages = styled.View`
  flex: 1;
  position: relative;
  background-color: ${colors.canvas};
`;

const NewMessagesButton = styled(Pressable)`
  position: absolute;
  right: 16px;
  bottom: 14px;
  z-index: 5;
  min-height: 40px;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: 8px 13px;
  border-width: 1px;
  border-color: ${colors.border};
  border-radius: 20px;
  background-color: ${colors.surface};
  shadow-color: #000;
  shadow-offset: 0px 3px;
  shadow-opacity: 0.14;
  shadow-radius: 6px;
  elevation: 5;
`;

const NewMessagesText = styled.Text`
  color: ${colors.brandDark};
  font-size: 12px;
  font-weight: 800;
`;

const MessageRow = styled.View<{ $mine: boolean; $hasReaction: boolean }>`
  width: 100%;
  align-items: ${({ $mine }) => ($mine ? "flex-end" : "flex-start")};
  padding: ${({ $hasReaction }) =>
    $hasReaction ? "3px 14px 15px" : "3px 14px"};
`;

const MessageBubbleShell = styled.View`
  position: relative;
  max-width: 78%;
  min-width: 72px;
`;

const Bubble = styled(Pressable)<{ $mine: boolean; $deleted: boolean }>`
  position: relative;
  max-width: 100%;
  min-width: 72px;
  gap: 7px;
  padding: ${({ $deleted }) => ($deleted ? "10px 12px" : "9px 11px 7px")};
  border-width: ${({ $mine }) => ($mine ? 0 : 1)}px;
  border-color: ${colors.border};
  border-radius: 8px;
  background-color: ${({ $mine, $deleted }) =>
    $deleted ? colors.surfaceMuted : $mine ? colors.brand : colors.surface};
  opacity: ${({ $deleted }) => ($deleted ? 0.78 : 1)};
`;

const MessageActionTrigger = styled(Pressable)<{ $mine: boolean }>`
  position: absolute;
  top: 4px;
  right: 4px;
  z-index: 4;
  width: 28px;
  height: 26px;
  align-items: center;
  justify-content: center;
  border-radius: 7px;
  background-color: ${({ $mine }) =>
    $mine ? "rgba(0, 0, 0, 0.2)" : colors.surfaceMuted};
  shadow-color: #000;
  shadow-offset: 0px 1px;
  shadow-opacity: 0.12;
  shadow-radius: 2px;
`;

const MessageText = styled.Text<{ $mine: boolean; $deleted?: boolean }>`
  color: ${({ $mine, $deleted }) =>
    $deleted ? colors.inkMuted : $mine ? colors.white : colors.ink};
  font-size: 15px;
  line-height: 21px;
  font-style: ${({ $deleted }) => ($deleted ? "italic" : "normal")};
`;

const MediaGrid = styled.View`
  gap: 6px;
`;

const MetaRow = styled.View`
  align-self: flex-end;
  flex-direction: row;
  align-items: center;
  gap: 4px;
`;

const Time = styled.Text<{ $mine: boolean }>`
  color: ${({ $mine }) =>
    $mine ? "rgba(255, 255, 255, 0.72)" : colors.inkMuted};
  font-size: 10px;
`;

const SeenLabel = styled.Text<{ $hasReaction: boolean }>`
  margin-top: ${({ $hasReaction }) => ($hasReaction ? 14 : 2)}px;
  margin-right: 14px;
  color: ${colors.inkMuted};
  font-size: 11px;
  font-weight: 700;
`;

const Reaction = styled.View`
  position: absolute;
  right: 4px;
  bottom: -12px;
  min-width: 29px;
  height: 24px;
  align-items: center;
  justify-content: center;
  padding: 0 5px;
  border-width: 2px;
  border-color: ${colors.canvas};
  border-radius: 12px;
  background-color: ${colors.surface};
`;

const ReactionText = styled.Text`
  font-size: 13px;
`;

const DateMarker = styled.View`
  align-self: center;
  margin: 10px 0;
  padding: 5px 10px;
  border-width: 1px;
  border-color: ${colors.border};
  border-radius: 12px;
  background-color: ${colors.surface};
`;

const DateMarkerText = styled.Text`
  color: ${colors.inkMuted};
  font-size: 11px;
  font-weight: 700;
`;

const UnreadDivider = styled.View`
  width: 100%;
  flex-direction: row;
  align-items: center;
  gap: 9px;
  padding: 10px 14px 7px;
`;

const UnreadDividerLine = styled.View`
  flex: 1;
  height: 1px;
  background-color: ${colors.brand};
  opacity: 0.38;
`;

const UnreadDividerLabel = styled.Text`
  color: ${colors.brandDark};
  font-size: 11px;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0.4px;
`;

const ComposerArea = styled.View`
  gap: 8px;
  padding: 10px 12px 12px;
  border-top-width: 1px;
  border-top-color: ${colors.border};
  background-color: ${colors.surface};
`;

const FileStrip = styled.ScrollView`
  flex-grow: 0;
`;

const FileChip = styled.View`
  min-height: 34px;
  max-width: 210px;
  flex-direction: row;
  align-items: center;
  gap: 6px;
  padding: 4px 5px 4px 9px;
  border-width: 1px;
  border-color: ${colors.border};
  border-radius: 8px;
  background-color: ${colors.surfaceMuted};
`;

const FileChipText = styled.Text.attrs({ numberOfLines: 1 })`
  flex: 1;
  color: ${colors.ink};
  font-size: 12px;
  font-weight: 700;
`;

const Composer = styled.View<{ $focused: boolean }>`
  min-height: 44px;
  flex-direction: row;
  align-items: flex-end;
  gap: 4px;
  padding: 2px 4px;
  border-width: 1px;
  border-color: ${({ $focused }) => ($focused ? colors.brand : colors.border)};
  border-radius: 8px;
  background-color: ${colors.surface};
`;

const Input = styled.TextInput`
  flex: 1;
  min-width: 0;
  padding: 7px 8px;
  color: ${colors.ink};
  font-size: 15px;
  line-height: 20px;
`;

const SendButton = styled(Pressable)<{ $enabled: boolean }>`
  width: 40px;
  height: 40px;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background-color: ${({ $enabled }) =>
    $enabled ? colors.brand : colors.border};
`;

const Empty = styled.View`
  flex: 1;
  align-items: center;
  justify-content: center;
  gap: 8px;
`;

const EmptyText = styled.Text`
  color: ${colors.inkMuted};
  font-size: 14px;
`;

const Backdrop = styled(SafeAreaView)`
  flex: 1;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background-color: ${colors.overlay};
`;

const Dialog = styled.View`
  width: 100%;
  max-width: 420px;
  gap: 14px;
  padding: 18px;
  border-radius: 8px;
  background-color: ${colors.surface};
`;

const DialogTitle = styled.Text`
  color: ${colors.ink};
  font-size: 17px;
  font-weight: 800;
`;

const DialogHeader = styled.View`
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
`;

const ReactionBar = styled.View`
  flex-direction: row;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 8px;
`;

const EmojiButton = styled(Pressable)<{ $active: boolean }>`
  width: 44px;
  height: 44px;
  align-items: center;
  justify-content: center;
  border-width: 1px;
  border-color: ${({ $active }) => ($active ? colors.brand : colors.border)};
  border-radius: 8px;
  background-color: ${({ $active }) =>
    $active ? colors.brandSoft : colors.surface};
`;

const Emoji = styled.Text`
  font-size: 22px;
`;

const Destructive = styled(Pressable)`
  min-height: 46px;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border-width: 1px;
  border-color: ${colors.coral};
  border-radius: 8px;
  background-color: ${colors.coralSoft};
`;

const DestructiveText = styled.Text`
  color: ${colors.coral};
  font-size: 14px;
  font-weight: 800;
`;

const ActionButton = styled(Pressable)`
  min-height: 46px;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border-width: 1px;
  border-color: ${colors.border};
  border-radius: 8px;
  background-color: ${colors.surface};
`;

const ActionButtonText = styled.Text`
  color: ${colors.ink};
  font-size: 14px;
  font-weight: 800;
`;

const EmojiPanel = styled.View`
  width: 100%;
  overflow: hidden;
  border-width: 1px;
  border-color: ${colors.border};
  border-radius: 12px;
  background-color: ${colors.surface};
`;

const EmojiPanelHeader = styled.View`
  min-height: 48px;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  padding: 4px 8px 4px 16px;
  border-bottom-width: 1px;
  border-bottom-color: ${colors.border};
`;

const EmojiPanelTitle = styled.Text`
  color: ${colors.ink};
  font-size: 15px;
  font-weight: 800;
`;

function mergeMessage(items: ChatMessage[], next: ChatMessage) {
  const index = items.findIndex(
    (item) =>
      item.id === next.id ||
      (next.clientMessageId && item.clientMessageId === next.clientMessageId),
  );
  if (index === -1) return [...items, next];
  const copy = [...items];
  copy[index] = next;
  return copy;
}

export default function ChatScreen() {
  const params = useLocalSearchParams<Record<string, string>>();
  const { height, width } = useWindowDimensions();
  const { user, isDemo } = useAuth();
  const { realtime, subscribe } = useRealtime();
  const isRouteFocused = useIsFocused();
  const {
    clearActiveConnection,
    setActiveConnection,
  } = useNotification();
  const listRef = useRef<FlashListRef<ChatMessage>>(null);
  const inputRef = useRef<NativeTextInput>(null);
  const inputSelection = useRef({ start: 0, end: 0 });
  const textRef = useRef("");
  const { getMappingKey } = useMappingHelper();
  const localTypingController = useRef<TypingSignalController | null>(null);
  const remoteTypingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialScrollDone = useRef(false);
  const isNearBottom = useRef(true);
  const pendingBottomScroll = useRef<boolean | null>(null);
  const viewableMessageIds = useRef<Set<string>>(new Set());
  const seenInFlightMessageId = useRef<string | null>(null);
  const acknowledgedSeenMessageId = useRef<string | null>(null);
  const acknowledgeSeenRef = useRef<() => void>(() => undefined);
  const loadingNewerMessages = useRef(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [resolvedConnection, setResolvedConnection] = useState<Connection | null>(
    null,
  );
  const [text, setText] = useState("");
  const [inputHeight, setInputHeight] = useState(MIN_COMPOSER_INPUT_HEIGHT);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [files, setFiles] = useState<SelectedFile[]>([]);
  const [focused, setFocused] = useState(false);
  const [loadedConnectionId, setLoadedConnectionId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [typing, setTyping] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [selected, setSelected] = useState<ChatMessage | null>(null);
  const [editing, setEditing] = useState<ChatMessage | null>(null);
  const [newMessageCount, setNewMessageCount] = useState(0);
  const [hoveredMessageId, setHoveredMessageId] = useState<string | null>(null);
  const [firstUnreadMessageId, setFirstUnreadMessageId] = useState<string | null>(
    null,
  );
  const [nextAfterCursor, setNextAfterCursor] = useState<string | null>(null);
  const [appIsActive, setAppIsActive] = useState(
    AppState.currentState === "active",
  );
  const [documentIsVisible, setDocumentIsVisible] = useState(
    Platform.OS !== "web" ||
      typeof document === "undefined" ||
      document.visibilityState === "visible",
  );
  const setRemoteTyping = useCallback((active: boolean) => {
    if (remoteTypingTimer.current) {
      clearTimeout(remoteTypingTimer.current);
      remoteTypingTimer.current = null;
    }
    setTyping(active);
    if (active) {
      remoteTypingTimer.current = setTimeout(() => {
        remoteTypingTimer.current = null;
        setTyping(false);
      }, REMOTE_TYPING_STALE_TIMEOUT_MS);
    }
  }, []);
  const loading = loadedConnectionId !== params.connectionId;
  const firstUnreadIndex = useMemo(
    () => findFirstUnreadIndex(messages, firstUnreadMessageId),
    [firstUnreadMessageId, messages],
  );

  const routeOtherUser = useMemo<PublicUser>(
    () => ({
      id: params.userId || "",
      username: params.username || "User",
      fullName: params.fullName || undefined,
      uniqueId: params.uniqueId || "",
      profilePicture: params.profilePicture
        ? { url: params.profilePicture }
        : undefined,
    }),
    [
      params.fullName,
      params.profilePicture,
      params.uniqueId,
      params.userId,
      params.username,
    ],
  );

  const otherUser =
    resolvedConnection?.id === params.connectionId
      ? resolvedConnection.otherUser
      : routeOtherUser;

  const demoConnection = useMemo<Connection>(
    () => ({
      id: params.connectionId,
      status: "accepted",
      direction: "outgoing",
      category: (params.category || "Friends") as Connection["category"],
      chatEnabled: true,
      awaitingYourCategory: false,
      awaitingOtherCategory: false,
      requestedAt: new Date().toISOString(),
      unreadCount: 0,
      otherUser: routeOtherUser,
    }),
    [params.category, params.connectionId, routeOtherUser],
  );

  const scrollToBottom = useCallback((animated = true) => {
    pendingBottomScroll.current = null;
    isNearBottom.current = true;
    setNewMessageCount(0);
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated });
    });
  }, []);

  const followNextMessage = useCallback((animated = true) => {
    pendingBottomScroll.current = animated;
  }, []);

  const handleContentSizeChange = useCallback(() => {
    const animated = pendingBottomScroll.current;

    if (animated === null) return;

    pendingBottomScroll.current = null;
    isNearBottom.current = true;
    setNewMessageCount(0);
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated });
    });
  }, []);

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
      const distanceFromBottom = Math.max(
        contentSize.height - layoutMeasurement.height - contentOffset.y,
        0,
      );
      const nextIsNearBottom = distanceFromBottom <= BOTTOM_FOLLOW_THRESHOLD_PX;

      isNearBottom.current = nextIsNearBottom;
      if (nextIsNearBottom) setNewMessageCount(0);
    },
    [],
  );

  const handleInitialListLoad = useCallback(() => {
    if (initialScrollDone.current) return;

    initialScrollDone.current = true;
    if (firstUnreadIndex >= 0) {
      isNearBottom.current = false;
      return;
    }

    scrollToBottom(false);
  }, [firstUnreadIndex, scrollToBottom]);

  const maintainChatPosition = useMemo(
    () => ({
      autoscrollToBottomThreshold: 0.2,
      animateAutoScrollToBottom: true,
      startRenderingFromBottom: firstUnreadIndex < 0,
    }),
    [firstUnreadIndex],
  );

  const updateReceipts = useCallback(
    (ids: string[], field: "deliveredAt" | "seenAt", value: string) => {
      setMessages((current) =>
        current.map((message) =>
          ids.includes(message.id)
            ? {
                ...message,
                receipts: message.receipts.map((receipt) => ({
                  ...receipt,
                  [field]: value,
                  ...(field === "seenAt"
                    ? { deliveredAt: receipt.deliveredAt ?? value }
                    : {}),
                })),
              }
            : message,
        ),
      );
    },
    [],
  );

  useFocusEffect(
    useCallback(() => {
      setActiveConnection(params.connectionId);
      return () => clearActiveConnection(params.connectionId);
    }, [clearActiveConnection, params.connectionId, setActiveConnection]),
  );

  useEffect(() => {
    const appStateSubscription = AppState.addEventListener("change", (state) => {
      setAppIsActive(state === "active");
    });
    const handleDocumentVisibility = () => {
      setDocumentIsVisible(document.visibilityState === "visible");
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

  const acknowledgeLatestViewableMessage = useCallback(() => {
    if (
      isDemo ||
      !canAcknowledgeSeen({
        isRouteFocused,
        isAppActive: appIsActive,
        isDocumentVisible: documentIsVisible,
      })
    ) {
      return;
    }

    const candidate = latestViewableUnreadMessage(
      messages,
      viewableMessageIds.current,
      otherUser.id,
    );
    if (
      !candidate ||
      seenInFlightMessageId.current === candidate.id ||
      acknowledgedSeenMessageId.current === candidate.id
    ) {
      return;
    }

    seenInFlightMessageId.current = candidate.id;
    void realtime
      .markSeen(candidate.id)
      .then(({ messageIds, seenAt }) => {
        acknowledgedSeenMessageId.current = candidate.id;
        if (seenAt) updateReceipts(messageIds, "seenAt", seenAt);
        requestAnimationFrame(() => acknowledgeSeenRef.current());
      })
      .catch(() => undefined)
      .finally(() => {
        if (seenInFlightMessageId.current === candidate.id) {
          seenInFlightMessageId.current = null;
        }
      });
  }, [
    appIsActive,
    documentIsVisible,
    isDemo,
    isRouteFocused,
    messages,
    otherUser.id,
    realtime,
    updateReceipts,
  ]);

  useEffect(() => {
    acknowledgeSeenRef.current = acknowledgeLatestViewableMessage;
    acknowledgeLatestViewableMessage();
  }, [acknowledgeLatestViewableMessage]);

  const handleViewableMessagesChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken<ChatMessage>[] }) => {
      viewableMessageIds.current = new Set(
        viewableItems.flatMap((token) =>
          token.isViewable && token.item ? [token.item.id] : [],
        ),
      );
      requestAnimationFrame(() => acknowledgeSeenRef.current());
    },
    [],
  );

  const loadNewerMessages = useCallback(async () => {
    if (isDemo || !nextAfterCursor || loadingNewerMessages.current) return;
    loadingNewerMessages.current = true;

    try {
      const history = await api.messages(params.connectionId, {
        after: nextAfterCursor,
      });
      setResolvedConnection(history.connection);
      setMessages((current) =>
        history.messages.reduce(
          (items, message) => mergeMessage(items, message),
          current,
        ),
      );
      setNextAfterCursor(history.nextAfterCursor);
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Newer messages could not be loaded.",
      );
    } finally {
      loadingNewerMessages.current = false;
    }
  }, [isDemo, nextAfterCursor, params.connectionId]);

  const synchronizeAfterReconnect = useCallback(async () => {
    if (isDemo) return;
    try {
      const history = await api.messages(params.connectionId);
      setResolvedConnection(history.connection);
      setMessages((current) =>
        history.messages.reduce(
          (items, message) => mergeMessage(items, message),
          current,
        ),
      );
      setNextAfterCursor(history.nextAfterCursor);
    } catch {
      // The next automatic reconnect or manual refresh can retry synchronization.
    }
  }, [isDemo, params.connectionId]);

  // Keep one receipt indicator below the latest outgoing message the recipient saw.
  const lastSeenMessage = useMemo(() => {
    return [...messages].reverse().find(
      (message) =>
        message.senderId === user?.id &&
        !message.isDeleted &&
        message.receipts.some((receipt) => Boolean(receipt.seenAt)),
    );
  }, [messages, user?.id]);
  const lastSeenAt = lastSeenMessage
    ? latestSeenAt(lastSeenMessage.receipts)
    : undefined;

  useEffect(() => {
    if (!user) return;
    let active = true;
    const cached = isDemo ? undefined : getChatSnapshot(params.connectionId);

    initialScrollDone.current = false;
    isNearBottom.current = true;
    pendingBottomScroll.current = null;
    viewableMessageIds.current.clear();
    seenInFlightMessageId.current = null;
    acknowledgedSeenMessageId.current = null;
    loadingNewerMessages.current = false;
    if (cached) {
      queueMicrotask(() => {
        if (!active) return;
        setResolvedConnection(cached.connection);
        setMessages(cached.messages);
        setFirstUnreadMessageId(cached.firstUnreadMessageId);
        setNextAfterCursor(cached.nextAfterCursor);
        setLoadedConnectionId(params.connectionId);
      });
    }

    void (async () => {
      try {
        const history = isDemo
          ? {
              connection: demoConnection,
              messages: demoMessages(demoConnection),
              firstUnreadMessageId: null,
              nextAfterCursor: null,
            }
          : await api.messages(params.connectionId);
        if (!active) return;
        setResolvedConnection(history.connection);
        setFirstUnreadMessageId(history.firstUnreadMessageId);
        setNextAfterCursor(history.nextAfterCursor);
        setMessages(history.messages);
        setNewMessageCount(0);
        setLoadedConnectionId(params.connectionId);
      } catch (error) {
        if (active) {
          if (!cached) {
            setResolvedConnection(null);
            setMessages([]);
            setFirstUnreadMessageId(null);
            setNextAfterCursor(null);
            setNewMessageCount(0);
          }
          setLoadedConnectionId(params.connectionId);
          setNotice(
            error instanceof Error ? error.message : "Messages could not be loaded.",
          );
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [demoConnection, isDemo, params.connectionId, user]);

  useEffect(() => {
    if (
      isDemo ||
      loadedConnectionId !== params.connectionId ||
      !resolvedConnection
    ) {
      return;
    }
    setChatSnapshot(params.connectionId, {
      connection: resolvedConnection,
      messages,
      firstUnreadMessageId,
      nextAfterCursor,
    });
  }, [
    firstUnreadMessageId,
    isDemo,
    loadedConnectionId,
    messages,
    nextAfterCursor,
    params.connectionId,
    resolvedConnection,
  ]);

  useEffect(() => {
    if (!user || !otherUser.id || isDemo) return;
    const typingController = new TypingSignalController((active) =>
      realtime.typing(otherUser.id, active),
    );
    localTypingController.current = typingController;
    const unsubscribe = subscribe({
      onConnect: ({ reconnected, recovered }) => {
        typingController.reset();
        requestAnimationFrame(() => acknowledgeSeenRef.current());
        if (reconnected && !recovered) void synchronizeAfterReconnect();
      },
      onDisconnect: () => setRemoteTyping(false),
      onMessage: (message) => {
        if (message.connectionId === params.connectionId) {
          if (message.senderId === otherUser.id) setRemoteTyping(false);
          const shouldFollow = message.senderId === user.id || isNearBottom.current;
          if (shouldFollow) {
            followNextMessage(true);
          } else {
            setNewMessageCount((count) => count + 1);
          }
          setMessages((items) => mergeMessage(items, message));
        }
      },
      onEdited: (message) => {
        if (message.connectionId === params.connectionId) {
          setMessages((items) => mergeMessage(items, message));
        }
      },
      onDelivered: ({ messageIds, deliveredAt }) =>
        updateReceipts(messageIds, "deliveredAt", deliveredAt),
      onSeen: ({ messageIds, seenAt }) =>
        updateReceipts(messageIds, "seenAt", seenAt),
      onUnreadCount: () => undefined,
      onReaction: ({ messageId, reactions }) => {
        setMessages((items) =>
          items.map((item) =>
            item.id === messageId ? { ...item, reactions } : item,
          ),
        );
      },
      onUnsent: ({ messageId, deletedAt }) =>
        setMessages((items) =>
          items.map((item) =>
            item.id === messageId
              ? {
                  ...item,
                  text: undefined,
                  media: [],
                  reactions: [],
                  isDeleted: true,
                  deletedAt,
                }
              : item,
          ),
        ),
      onTyping: (userId, active) => {
        if (userId === otherUser.id) setRemoteTyping(active);
      },
    });
    return () => {
      typingController.dispose();
      if (localTypingController.current === typingController) {
        localTypingController.current = null;
      }
      setRemoteTyping(false);
      unsubscribe();
    };
  }, [
    followNextMessage,
    isDemo,
    otherUser.id,
    params.connectionId,
    realtime,
    setRemoteTyping,
    subscribe,
    synchronizeAfterReconnect,
    updateReceipts,
    user,
  ]);

  const updateText = (value: string) => {
    textRef.current = value;
    setText(value);
    if (!isDemo) localTypingController.current?.update(value);
  };

  const insertEmoji = ({ emoji }: EmojiSelection) => {
    const current = textRef.current;
    const next = insertTextAtSelection(
      current,
      inputSelection.current,
      emoji,
      4000,
    );
    if (!next) return;

    inputSelection.current = next.selection;
    updateText(next.value);
    requestAnimationFrame(() => {
      inputRef.current?.setNativeProps({ selection: next.selection });
    });
  };

  const closeEmojiPicker = () => {
    setEmojiPickerOpen(false);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const validateFiles = (next: SelectedFile[]) => {
    if (files.length + next.length > MAX_FILES) {
      setNotice("You can send up to 3 files at once.");
      return false;
    }
    if (next.some((file) => file.size && file.size > MAX_FILE_BYTES)) {
      setNotice("Each file must be 5 MB or smaller.");
      return false;
    }
    return true;
  };

  const pickImages = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images", "videos"],
      allowsMultipleSelection: true,
      selectionLimit: MAX_FILES - files.length,
      quality: 1,
    });
    if (result.canceled) return;
    const selectedFiles = result.assets.map((asset, index) => ({
      uri: asset.uri,
      name:
        asset.fileName ??
        `media-${Date.now()}-${index}.${asset.mimeType?.split("/")[1] ?? "jpg"}`,
      mimeType:
        asset.mimeType ??
        (asset.type === "video" ? "video/mp4" : "image/jpeg"),
      size: asset.fileSize,
      file: "file" in asset ? (asset.file as File | undefined) : undefined,
    }));
    if (validateFiles(selectedFiles)) {
      setFiles((current) => [...current, ...selectedFiles]);
    }
  };

  const pickDocuments = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      multiple: true,
      copyToCacheDirectory: true,
    });
    if (result.canceled) return;
    const selectedFiles = result.assets.map((asset) => ({
      uri: asset.uri,
      name: asset.name,
      mimeType: asset.mimeType ?? "application/octet-stream",
      size: asset.size,
      file: asset.file,
    }));
    if (validateFiles(selectedFiles)) {
      setFiles((current) => [...current, ...selectedFiles]);
    }
  };

  const sendMessage = async () => {
    const body = text.trim();
    if ((!body && !files.length) || sending || !user) return;
    localTypingController.current?.stop();
    if (editing) {
      setSending(true);
      try {
        const result = isDemo
          ? {
              message: {
                ...editing,
                text: body,
                editedAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
            }
          : await api.editMessage(editing.id, body);
        setMessages((items) => mergeMessage(items, result.message));
        setEditing(null);
        textRef.current = "";
        setText("");
      } catch (error) {
        setNotice(
          error instanceof Error ? error.message : "Message could not be edited.",
        );
      } finally {
        setSending(false);
      }
      return;
    }
    const clientMessageId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    setSending(true);
    textRef.current = "";
    setText("");
    const queuedFiles = files;
    setFiles([]);
    const optimisticMessage = createOptimisticMessage({
      clientMessageId,
      connectionId: params.connectionId,
      senderId: user.id,
      recipientId: otherUser.id,
      text: body,
      files: queuedFiles,
    });
    followNextMessage(false);
    setMessages((items) => mergeMessage(items, optimisticMessage));
    try {
      let message: ChatMessage;
      if (isDemo) {
        message = {
          id: `demo-${clientMessageId}`,
          connectionId: params.connectionId,
          senderId: user.id,
          recipientId: otherUser.id,
          clientMessageId,
          text: body || undefined,
          media: queuedFiles.map((file, index) => ({
            id: `${clientMessageId}-${index}`,
            url: file.uri,
            resourceType: file.mimeType.startsWith("image/")
              ? "image"
              : file.mimeType.startsWith("video/")
                ? "video"
                : "raw",
            originalName: file.name,
            mimeType: file.mimeType,
            bytes: file.size ?? 1,
          })),
          kind:
            body && queuedFiles.length
              ? "mixed"
              : queuedFiles.length
                ? "media"
                : "text",
          reactions: [],
          receipts: [
            {
              userId: otherUser.id,
              deliveredAt: new Date().toISOString(),
              seenAt: new Date().toISOString(),
            },
          ],
          isDeleted: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      } else if (queuedFiles.length) {
        const form = new FormData();
        form.append("recipientId", otherUser.id);
        form.append("clientMessageId", clientMessageId);
        if (body) form.append("text", body);
        queuedFiles.forEach((file) =>
          form.append(
            "files",
            file.file ??
              ({
                uri: file.uri,
                name: file.name,
                type: file.mimeType,
              } as unknown as Blob),
          ),
        );
        message = (await api.uploadMedia(form)).message;
      } else {
        message = (
          await realtime.sendMessage({
            recipientId: otherUser.id,
            text: body,
            clientMessageId,
          })
        ).message;
      }
      followNextMessage(true);
      setMessages((items) => mergeMessage(items, message));
    } catch (error) {
      setMessages((items) =>
        items.filter((item) => item.clientMessageId !== clientMessageId),
      );
      const currentDraft = textRef.current;
      const restoredDraft = currentDraft
        ? `${body}${body ? "\n" : ""}${currentDraft}`
        : body;
      textRef.current = restoredDraft;
      setText(restoredDraft);
      setFiles((current) => [...queuedFiles, ...current].slice(0, MAX_FILES));
      setNotice(
        error instanceof Error ? error.message : "Message could not be sent.",
      );
    } finally {
      setSending(false);
    }
  };

  const react = async (emoji: string) => {
    if (!selected || !user) return;
    const target = selected;
    const previousReactions = target.reactions;
    const optimisticReactions = toggleOwnReaction(
      previousReactions,
      user.id,
      emoji,
    );
    setMessages((items) =>
      items.map((item) =>
        item.id === target.id ? { ...item, reactions: optimisticReactions } : item,
      ),
    );
    setSelected(null);
    try {
      let reactions: MessageReaction[];
      if (isDemo) {
        reactions = optimisticReactions;
      } else {
        reactions = (await realtime.react(target.id, emoji)).reactions;
      }
      setMessages((items) =>
        items.map((item) =>
          item.id === target.id ? { ...item, reactions } : item,
        ),
      );
    } catch (error) {
      setMessages((items) =>
        items.map((item) =>
          item.id === target.id
            ? {
                ...item,
                reactions: restoreOwnReaction(
                  item.reactions,
                  previousReactions,
                  user.id,
                ),
              }
            : item,
        ),
      );
      setNotice(error instanceof Error ? error.message : "Reaction failed.");
    }
  };

  const unsend = async () => {
    if (!selected) return;
    try {
      if (!isDemo) await api.unsend(selected.id);
      setMessages((items) =>
        items.map((item) =>
          item.id === selected.id
            ? {
                ...item,
                text: undefined,
                media: [],
                reactions: [],
                isDeleted: true,
                deletedAt: new Date().toISOString(),
              }
            : item,
        ),
      );
      setSelected(null);
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Message could not be unsent.",
      );
    }
  };

  const beginEdit = () => {
    if (!selected?.text) return;
    const elapsed = Date.now() - new Date(selected.createdAt).getTime();
    if (elapsed > 10 * 60 * 1000) {
      setNotice("Messages can only be edited within 10 minutes of sending.");
      setSelected(null);
      return;
    }
    setEditing(selected);
    textRef.current = selected.text;
    setText(selected.text);
    setSelected(null);
  };


  const handleInputKeyPress = (event: {
    nativeEvent: { key?: string; shiftKey?: boolean };
    preventDefault?: () => void;
  }) => {
    if (Platform.OS !== "web") return;
    if (event.nativeEvent.key === "Enter" && !event.nativeEvent.shiftKey) {
      event.preventDefault?.();
      void sendMessage();
    }
  };

  if (!user) return <Redirect href="/login" />;
  const hasContent = Boolean(text.trim() || files.length);

  return (
    <Screen>
      <Shell
        $wide={width >= 760}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={0}
      >
        <Header>
          <IconButton
            icon={ArrowLeft}
            label="Back"
            onPress={() => router.back()}
          />
          <Avatar user={otherUser} size={44} />
          <Person>
            <Name>{displayName(otherUser)}</Name>
            <Presence>
              {typing
                ? "typing..."
                : `@${otherUser.username}${params.category ? ` · ${params.category}` : ""}`}
            </Presence>
          </Person>
          <IconButton icon={MoreVertical} label="Conversation options" />
        </Header>
        {notice ? (
          <Notice message={notice} error onClose={() => setNotice(null)} />
        ) : null}
        <Messages>
          {loading ? (
            <Empty>
              <ActivityIndicator color={colors.brand} />
              <EmptyText>Loading conversation</EmptyText>
            </Empty>
          ) : messages.length ? (
            <FlashList
              ref={listRef}
              data={messages}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{
                paddingVertical: 14,
              }}
              initialScrollIndex={
                firstUnreadIndex >= 0 ? firstUnreadIndex : undefined
              }
              maintainVisibleContentPosition={maintainChatPosition}
              onContentSizeChange={handleContentSizeChange}
              onLoad={handleInitialListLoad}
              onEndReached={() => void loadNewerMessages()}
              onEndReachedThreshold={0.35}
              onScroll={handleScroll}
              onViewableItemsChanged={handleViewableMessagesChanged}
              scrollEventThrottle={16}
              viewabilityConfig={MESSAGE_VIEWABILITY_CONFIG}
              renderItem={({ item, index }) => {
                const mine = item.senderId === user.id;
                const prior = messages[index - 1];
                const showDate =
                  !prior || !isSameCalendarDay(prior.createdAt, item.createdAt);
                return (
                  <>
                    {showDate ? (
                      <DateMarker>
                        <DateMarkerText>
                          {chatDateLabel(item.createdAt)}
                        </DateMarkerText>
                      </DateMarker>
                    ) : null}
                    {item.id === firstUnreadMessageId ? (
                      <UnreadDivider accessibilityLabel="New unread messages start here">
                        <UnreadDividerLine />
                        <UnreadDividerLabel>New messages</UnreadDividerLabel>
                        <UnreadDividerLine />
                      </UnreadDivider>
                    ) : null}
                    <MessageRow
                      $mine={mine}
                      $hasReaction={item.reactions.length > 0}
                    >
                      <MessageBubbleShell
                        onPointerEnter={() => setHoveredMessageId(item.id)}
                        onPointerLeave={() =>
                          setHoveredMessageId((current) =>
                            current === item.id ? null : current,
                          )
                        }
                      >
                        <Bubble
                          $mine={mine}
                          $deleted={item.isDeleted}
                          disabled={item.pending}
                          onLongPress={() =>
                            !item.isDeleted && setSelected(item)
                          }
                          delayLongPress={320}
                        >
                          {item.isDeleted ? (
                            <MessageText $mine={mine} $deleted>
                              Message unsent
                            </MessageText>
                          ) : (
                            <>
                              {item.media.length ? (
                                <MediaGrid>
                                  {item.media.map((media, mediaIndex) => (
                                    <WhatsAppMediaCard
                                      key={getMappingKey(
                                        media.id ?? media.url,
                                        mediaIndex,
                                      )}
                                      media={media}
                                      mine={mine}
                                    />
                                  ))}
                                </MediaGrid>
                              ) : null}
                              {item.text ? (
                                <MessageText $mine={mine}>
                                  {item.text}
                                  {item.editedAt ? " (edited)" : ""}
                                </MessageText>
                              ) : null}
                              <MetaRow>
                                <Time $mine={mine}>
                                  {item.pending ? "Sending..." : messageTime(item.createdAt)}
                                </Time>
                              </MetaRow>
                            </>
                          )}
                          {item.reactions.length ? (
                            <Reaction>
                              <ReactionText>
                                {item.reactions
                                  .map((reaction) => reaction.emoji)
                                  .slice(0, 3)
                                  .join("")}
                              </ReactionText>
                            </Reaction>
                          ) : null}
                        </Bubble>
                        {shouldShowMessageAction({
                          isWeb: Platform.OS === "web",
                          isHovered: hoveredMessageId === item.id,
                          isDeleted: item.isDeleted,
                          isPending: Boolean(item.pending),
                        }) ? (
                          <MessageActionTrigger
                            $mine={mine}
                            accessibilityRole="button"
                            accessibilityLabel="Open message actions"
                            onPressIn={() => setHoveredMessageId(item.id)}
                            onPress={() => setSelected(item)}
                          >
                            <ChevronDown
                              size={17}
                              color={mine ? colors.white : colors.inkMuted}
                            />
                          </MessageActionTrigger>
                        ) : null}
                      </MessageBubbleShell>
                      {mine && item.id === lastSeenMessage?.id && lastSeenAt ? (
                        <SeenLabel $hasReaction={item.reactions.length > 0}>
                          {seenReceiptLabel(lastSeenAt)}
                        </SeenLabel>
                      ) : null}
                    </MessageRow>
                  </>
                );
              }}
            />
          ) : (
            <Empty>
              <SmilePlus size={28} color={colors.inkMuted} />
              <EmptyText>Start the conversation</EmptyText>
            </Empty>
          )}
          {newMessageCount > 0 ? (
            <NewMessagesButton onPress={() => scrollToBottom(true)}>
              <ChevronDown size={16} color={colors.brandDark} />
              <NewMessagesText>
                {newMessageCount === 1
                  ? "1 new message"
                  : `${newMessageCount} new messages`}
              </NewMessagesText>
            </NewMessagesButton>
          ) : null}
        </Messages>
        {typing ? <TypingIndicator user={otherUser} /> : null}
        <ComposerArea>
          {files.length ? (
            <FileStrip
              horizontal
              contentContainerStyle={{ gap: 7 }}
              showsHorizontalScrollIndicator={false}
            >
              {files.map((file, index) => (
                <FileChip key={`${file.uri}-${index}`}>
                  <Paperclip size={14} color={colors.inkMuted} />
                  <FileChipText>{file.name}</FileChipText>
                  <IconButton
                    icon={X}
                    label={`Remove ${file.name}`}
                    onPress={() =>
                      setFiles((items) =>
                        items.filter((_, itemIndex) => itemIndex !== index),
                      )
                    }
                  />
                </FileChip>
              ))}
            </FileStrip>
          ) : null}
          {editing ? (
            <FileChip>
              <Edit3 size={14} color={colors.inkMuted} />
              <FileChipText>Editing message</FileChipText>
              <IconButton
                icon={X}
                label="Cancel edit"
                onPress={() => {
                  setEditing(null);
                  textRef.current = "";
                  setText("");
                }}
              />
            </FileChip>
          ) : null}
          <Composer $focused={focused}>
            <IconButton
              icon={ImagePlus}
              label="Add photos or videos"
              onPress={pickImages}
            />
            <IconButton
              icon={SmilePlus}
              label="Open emoji picker"
              tone={emojiPickerOpen ? "soft" : "plain"}
              onPress={() => {
                Keyboard.dismiss();
                setEmojiPickerOpen(true);
              }}
            />
            <IconButton
              icon={Paperclip}
              label="Add documents"
              onPress={pickDocuments}
            />
            <Input
              ref={inputRef}
              accessibilityLabel="Message"
              multiline
              maxLength={4000}
              onContentSizeChange={({ nativeEvent }) => {
                setInputHeight(clampComposerInputHeight(
                  nativeEvent.contentSize.height,
                  MIN_COMPOSER_INPUT_HEIGHT,
                  MAX_COMPOSER_INPUT_HEIGHT,
                ));
              }}
              onSelectionChange={({ nativeEvent }) => {
                inputSelection.current = nativeEvent.selection;
              }}
              scrollEnabled={inputHeight >= MAX_COMPOSER_INPUT_HEIGHT}
              style={{ height: inputHeight }}
              textAlignVertical="top"
              value={text}
              onChangeText={updateText}
              onFocus={() => {
                setEmojiPickerOpen(false);
                setFocused(true);
                if (isNearBottom.current) scrollToBottom(true);
              }}
              onBlur={() => {
                setFocused(false);
                localTypingController.current?.stop();
              }}
              onKeyPress={handleInputKeyPress}
              placeholder="Type Message"
              placeholderTextColor={colors.inkMuted}
            />
            <SendButton
              accessibilityRole="button"
              accessibilityLabel="Send message"
              $enabled={hasContent}
              disabled={!hasContent || sending}
              onPress={sendMessage}
            >
              {sending ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <Send size={19} color={colors.white} />
              )}
            </SendButton>
          </Composer>
          {emojiPickerOpen ? (
            <EmojiPanel
              style={{ height: Math.min(400, Math.max(180, height * 0.46)) }}
            >
              <EmojiPanelHeader>
                <EmojiPanelTitle>Emojis</EmojiPanelTitle>
                <IconButton
                  icon={X}
                  label="Close emoji picker"
                  onPress={closeEmojiPicker}
                />
              </EmojiPanelHeader>
              <EmojiPicker
                categoryBarPosition="bottom"
                colorScheme="light"
                enableRecentlyUsed
                enableSearch
                maxEmojiVersion="auto"
                onEmojiSelected={insertEmoji}
                theme={{
                  colors: {
                    accent: colors.accent,
                    background: colors.surface,
                    categoryActiveBackground: colors.brandSoft,
                    categoryBarBackground: colors.surface,
                    divider: colors.border,
                    searchBackground: colors.surfaceMuted,
                    searchPlaceholder: colors.inkMuted,
                    searchText: colors.ink,
                    secondaryText: colors.inkMuted,
                    text: colors.ink,
                  },
                }}
              />
            </EmojiPanel>
          ) : null}
        </ComposerArea>
      </Shell>
      <Modal
        transparent
        visible={Boolean(selected)}
        animationType="fade"
        onRequestClose={() => setSelected(null)}
      >
        <Backdrop>
          <Dialog>
            <DialogHeader>
              <DialogTitle>Message actions</DialogTitle>
              <IconButton
                icon={X}
                label="Close"
                onPress={() => setSelected(null)}
              />
            </DialogHeader>
            <ReactionBar>
              {REACTIONS.map((emoji) => (
                <EmojiButton
                  key={emoji}
                  $active={
                    selected?.reactions.some(
                      (reaction) =>
                        reaction.userId === user.id &&
                        reaction.emoji === emoji,
                    ) ?? false
                  }
                  onPress={() => react(emoji)}
                >
                  <Emoji>{emoji}</Emoji>
                </EmojiButton>
              ))}
            </ReactionBar>
            {selected?.senderId === user.id && selected?.text && !selected?.isDeleted ? (
              <ActionButton onPress={beginEdit}>
                <Edit3 size={18} color={colors.ink} />
                <ActionButtonText>Edit message</ActionButtonText>
              </ActionButton>
            ) : null}

            {selected?.senderId === user.id && !selected?.isDeleted ? (
              <Destructive onPress={unsend}>
                <Trash2 size={18} color={colors.coral} />
                <DestructiveText>Unsend for everyone</DestructiveText>
              </Destructive>
            ) : null}
          </Dialog>
        </Backdrop>
      </Modal>
    </Screen>
  );
}

