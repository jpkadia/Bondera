import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import {
  ArrowLeft,
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
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  useWindowDimensions,
} from "react-native";
import { styled } from "styled-components/native";

import { Avatar } from "@/components/Avatar";
import { IconButton } from "@/components/IconButton";
import { Notice } from "@/components/Notice";
import { WhatsAppMediaCard } from "@/components/WhatsAppMediaCard";
import { useAuth } from "@/context/AuthContext";
import { demoMessages } from "@/data/demo";
import { api } from "@/services/api";
import { RealtimeClient } from "@/services/socket";
import { colors } from "@/theme";
import type { ChatMessage, Connection, MessageReaction, PublicUser } from "@/types/api";
import { displayName, messageTime } from "@/utils/format";

const MAX_FILES = 3;
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const REACTIONS = ["❤", "👍", "😂", "😮", "😢", "🙏"];

interface SelectedFile {
  uri: string;
  name: string;
  mimeType: string;
  size?: number;
  file?: File;
}

const Screen = styled.SafeAreaView`
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
  background-color: ${colors.canvas};
`;

const MessageRow = styled.View<{ $mine: boolean }>`
  width: 100%;
  align-items: ${({ $mine }) => ($mine ? "flex-end" : "flex-start")};
  padding: 3px 14px;
`;

const Bubble = styled(Pressable)<{ $mine: boolean; $deleted: boolean }>`
  max-width: 78%;
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

const SeenLabel = styled.Text`
  margin-top: 2px;
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

const DateMarker = styled.Text`
  align-self: center;
  margin: 10px 0;
  color: ${colors.inkMuted};
  font-size: 11px;
  font-weight: 700;
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
  min-height: 50px;
  flex-direction: row;
  align-items: flex-end;
  gap: 4px;
  padding: 4px;
  border-width: 1px;
  border-color: ${({ $focused }) => ($focused ? colors.brand : colors.border)};
  border-radius: 8px;
  background-color: ${colors.surface};
`;

const Input = styled.TextInput`
  flex: 1;
  min-width: 0;
  max-height: 116px;
  padding: 9px 8px;
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

const Backdrop = styled.View`
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
  align-items: center;
  justify-content: space-between;
  gap: 4px;
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
  const { width } = useWindowDimensions();
  const { user, accessToken, isDemo } = useAuth();
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const [realtime] = useState(() => new RealtimeClient());
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialScrollDone = useRef(false);
  const firstUnreadMessageId = useRef<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [files, setFiles] = useState<SelectedFile[]>([]);
  const [focused, setFocused] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [typing, setTyping] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [selected, setSelected] = useState<ChatMessage | null>(null);
  const [editing, setEditing] = useState<ChatMessage | null>(null);

  const otherUser = useMemo<PublicUser>(
    () => ({
      id: params.userId,
      username: params.username,
      fullName: params.fullName || undefined,
      uniqueId: params.uniqueId,
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
      otherUser,
    }),
    [otherUser, params.category, params.connectionId],
  );

  const scrollToBottom = useCallback((animated = true) => {
    setTimeout(() => {
      listRef.current?.scrollToEnd({ animated });
    }, 60);
  }, []);

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

  // Determine last seen message sent by current user for Instagram-style "Seen" indicator
  const lastSeenMessageId = useMemo(() => {
    const seenSentMessages = messages.filter(
      (m) =>
        m.senderId === user?.id &&
        !m.isDeleted &&
        m.receipts.some((r) => Boolean(r.seenAt)),
    );
    return seenSentMessages[seenSentMessages.length - 1]?.id ?? null;
  }, [messages, user?.id]);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      try {
        const history = isDemo
          ? {
              messages: demoMessages(demoConnection),
              firstUnreadMessageId: null,
            }
          : await api.messages(params.connectionId);
        firstUnreadMessageId.current = history.firstUnreadMessageId;
        setMessages(history.messages);
      } catch (error) {
        setNotice(
          error instanceof Error ? error.message : "Messages could not be loaded.",
        );
      } finally {
        setLoading(false);
      }
    })();
  }, [demoConnection, isDemo, params.connectionId, user]);

  useEffect(() => {
    if (!accessToken || !user) return;
    realtime.connect(accessToken, {
      onMessage: (message) => {
        if (message.connectionId === params.connectionId) {
          setMessages((items) => mergeMessage(items, message));
          scrollToBottom(true);
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
      onReaction: ({ messageId, reactions }) =>
        setMessages((items) =>
          items.map((item) =>
            item.id === messageId ? { ...item, reactions } : item,
          ),
        ),
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
        if (userId === otherUser.id) setTyping(active);
      },
    });
    return () => realtime.disconnect();
  }, [
    accessToken,
    otherUser.id,
    params.connectionId,
    realtime,
    scrollToBottom,
    updateReceipts,
    user,
  ]);

  useEffect(() => {
    const latestUnread = [...messages]
      .reverse()
      .find(
        (message) =>
          message.senderId === otherUser.id &&
          !message.isDeleted &&
          !message.receipts.some((receipt) => receipt.seenAt),
      );
    if (latestUnread && !isDemo) {
      void realtime.markSeen(latestUnread.id).catch(() => undefined);
    }
  }, [isDemo, messages, otherUser.id, realtime]);

  const updateText = (value: string) => {
    setText(value);
    if (!isDemo) {
      realtime.typing(otherUser.id, Boolean(value.trim()));
      if (typingTimer.current) clearTimeout(typingTimer.current);
      typingTimer.current = setTimeout(
        () => realtime.typing(otherUser.id, false),
        1200,
      );
    }
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
    setText("");
    const queuedFiles = files;
    setFiles([]);
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
      setMessages((items) => mergeMessage(items, message));
      realtime.typing(otherUser.id, false);
      scrollToBottom(true);
    } catch (error) {
      setText(body);
      setFiles(queuedFiles);
      setNotice(
        error instanceof Error ? error.message : "Message could not be sent.",
      );
    } finally {
      setSending(false);
    }
  };

  const react = async (emoji: string) => {
    if (!selected || !user) return;
    try {
      let reactions: MessageReaction[];
      if (isDemo) {
        const others = selected.reactions.filter(
          (reaction) => reaction.userId !== user.id,
        );
        const own = selected.reactions.find(
          (reaction) => reaction.userId === user.id,
        );
        reactions =
          own?.emoji === emoji
            ? others
            : [
                ...others,
                {
                  userId: user.id,
                  emoji,
                  reactedAt: new Date().toISOString(),
                },
              ];
      } else {
        reactions = (await realtime.react(selected.id, emoji)).reactions;
      }
      setMessages((items) =>
        items.map((item) =>
          item.id === selected.id ? { ...item, reactions } : item,
        ),
      );
      setSelected(null);
    } catch (error) {
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
          ) : (
            <FlatList
              ref={listRef}
              data={messages}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{
                flexGrow: 1,
                justifyContent: messages.length ? "flex-end" : "center",
                paddingVertical: 14,
                gap: 7,
              }}
              onContentSizeChange={() => {
                if (!initialScrollDone.current) {
                  const unreadIndex = firstUnreadMessageId.current
                    ? messages.findIndex(
                        (message) =>
                          message.id === firstUnreadMessageId.current,
                      )
                    : -1;
                  if (unreadIndex >= 0) {
                    listRef.current?.scrollToIndex({
                      index: unreadIndex,
                      animated: false,
                      viewPosition: 0.18,
                    });
                  } else {
                    listRef.current?.scrollToEnd({ animated: false });
                  }
                  initialScrollDone.current = true;
                  return;
                }
                listRef.current?.scrollToEnd({ animated: true });
              }}
              onScrollToIndexFailed={() =>
                listRef.current?.scrollToEnd({ animated: false })
              }
              ListEmptyComponent={
                <Empty>
                  <SmilePlus size={28} color={colors.inkMuted} />
                  <EmptyText>Start the conversation</EmptyText>
                </Empty>
              }
              renderItem={({ item, index }) => {
                const mine = item.senderId === user.id;
                const prior = messages[index - 1];
                const showDate =
                  !prior ||
                  new Date(prior.createdAt).toDateString() !==
                    new Date(item.createdAt).toDateString();
                return (
                  <>
                    {showDate ? (
                      <DateMarker>
                        {new Intl.DateTimeFormat(undefined, {
                          month: "short",
                          day: "numeric",
                        }).format(new Date(item.createdAt))}
                      </DateMarker>
                    ) : null}
                    <MessageRow $mine={mine}>
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
                                {item.media.map((media) => (
                                  <WhatsAppMediaCard
                                    key={media.id ?? media.url}
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
                                {messageTime(item.createdAt)}
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
                      {mine && item.id === lastSeenMessageId ? (
                        <SeenLabel>Seen</SeenLabel>
                      ) : null}
                    </MessageRow>
                  </>
                );
              }}
            />
          )}
        </Messages>
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
              icon={Paperclip}
              label="Add documents"
              onPress={pickDocuments}
            />
            <Input
              accessibilityLabel="Message"
              multiline
              maxLength={4000}
              value={text}
              onChangeText={updateText}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onKeyPress={handleInputKeyPress}
              placeholder="Message (Enter to send, Shift+Enter for newline)"
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

