import { Redirect, router } from "expo-router";
import {
  ArrowLeft,
  Bot,
  History as HistoryIcon,
  MessageSquarePlus,
  PanelLeft,
  Send,
  Sparkles,
  Trash2,
  X,
} from "lucide-react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { styled } from "styled-components/native";

import { IconButton } from "@/components/IconButton";
import { Notice } from "@/components/Notice";
import { useAuth } from "@/context/AuthContext";
import { api, ApiError } from "@/services/api";
import {
  removeAiConversation as removeAiConversationFromList,
  shouldShowAiSuggestions,
  upsertAiConversation,
} from "@/services/ai-conversations";
import {
  deleteAiConversation,
  loadAiConversations,
  saveAiConversations,
  type StoredAiConversation,
} from "@/services/aiChatStorage";
import { colors } from "@/theme";
import type { PremiumRequestSummary } from "@/types/api";

interface AiTurn {
  id: string;
  question: string;
  answer: string;
  textMessagesAnalyzed: number;
  historyTruncated: boolean;
}

const Screen = styled(SafeAreaView)`
  flex: 1;
  background-color: ${colors.canvas};
`;

const Topbar = styled.View<{ $compact: boolean }>`
  min-height: 68px;
  flex-direction: row;
  align-items: center;
  gap: ${({ $compact }) => ($compact ? 5 : 10)}px;
  padding: ${({ $compact }) => ($compact ? "8px" : "10px 16px")};
  border-bottom-width: 1px;
  border-bottom-color: ${colors.border};
  background-color: ${colors.surface};
`;

const BrandMark = styled.View`
  width: 38px;
  height: 38px;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background-color: ${colors.black};
`;

const TitleBlock = styled.View`
  flex: 1;
  min-width: 0;
`;

const Title = styled.Text.attrs({ numberOfLines: 1 })`
  color: ${colors.ink};
  font-size: 19px;
  font-weight: 900;
`;

const Subtitle = styled.Text.attrs({ numberOfLines: 1 })`
  color: ${colors.inkMuted};
  font-size: 12px;
`;

const Shell = styled(KeyboardAvoidingView)`
  flex: 1;
`;

const Content = styled.View<{ $compact: boolean }>`
  width: 100%;
  max-width: 1040px;
  align-self: center;
  flex: 1;
  flex-direction: row;
  padding: ${({ $compact }) => ($compact ? 10 : 16)}px;
  gap: ${({ $compact }) => ($compact ? 8 : 12)}px;
`;

const Sidebar = styled.View<{ $visible: boolean }>`
  display: ${({ $visible }) => ($visible ? "flex" : "none")};
  width: 270px;
  gap: 10px;
  padding: 12px;
  border-width: 1px;
  border-color: ${colors.border};
  border-radius: 8px;
  background-color: ${colors.surface};
`;

const ChatPane = styled.View`
  flex: 1;
  min-width: 0;
  gap: 12px;
`;

const NewChatButton = styled(Pressable)`
  min-height: 42px;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 9px 12px;
  border-radius: 8px;
  background-color: ${colors.brand};
`;

const NewChatText = styled.Text`
  color: ${colors.white};
  font-size: 14px;
  font-weight: 900;
`;

const PastChatList = styled.ScrollView`
  flex: 1;
`;

const PastChatItem = styled.View<{ $active: boolean }>`
  min-height: 46px;
  flex-direction: row;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  border-width: 1px;
  border-color: ${({ $active }) => ($active ? colors.brand : colors.border)};
  border-radius: 8px;
  background-color: ${({ $active }) => ($active ? colors.brandSoft : colors.surface)};
  margin-bottom: 7px;
`;

const PastChatSelectable = styled(Pressable)`
  flex: 1;
  min-width: 0;
  justify-content: center;
`;

const PastChatTitle = styled.Text.attrs({ numberOfLines: 1 })`
  color: ${colors.ink};
  font-size: 13px;
  font-weight: 800;
`;

const PastChatMeta = styled.Text.attrs({ numberOfLines: 1 })`
  color: ${colors.inkMuted};
  font-size: 11px;
`;

const LockedPanel = styled.View`
  margin-top: 42px;
  gap: 14px;
  padding: 22px;
  border-width: 1px;
  border-color: ${colors.border};
  border-radius: 8px;
  background-color: ${colors.surface};
`;

const LockedTitle = styled.Text`
  color: ${colors.ink};
  font-size: 20px;
  font-weight: 900;
`;

const LockedText = styled.Text`
  color: ${colors.inkMuted};
  font-size: 14px;
  line-height: 20px;
`;

const PremiumStatus = styled.View<{ $tone: "plain" | "pending" | "error" }>`
  align-self: flex-start;
  padding: 7px 10px;
  border-radius: 8px;
  background-color: ${({ $tone }) =>
    $tone === "pending"
      ? colors.amberSoft
      : $tone === "error"
        ? colors.coralSoft
        : colors.surfaceMuted};
`;

const PremiumStatusText = styled.Text<{ $tone: "plain" | "pending" | "error" }>`
  color: ${({ $tone }) =>
    $tone === "pending"
      ? colors.amber
      : $tone === "error"
        ? colors.coral
        : colors.ink};
  font-size: 13px;
  font-weight: 800;
`;

const PremiumRequestButton = styled(Pressable)`
  min-height: 46px;
  align-items: center;
  justify-content: center;
  padding: 10px 14px;
  border-radius: 8px;
  background-color: ${colors.brand};
`;

const PremiumRequestText = styled.Text`
  color: ${colors.white};
  font-size: 14px;
  font-weight: 900;
`;

const ExampleGrid = styled.View`
  gap: 8px;
`;

const Example = styled(Pressable)`
  min-height: 42px;
  justify-content: center;
  padding: 9px 12px;
  border-width: 1px;
  border-color: ${colors.border};
  border-radius: 8px;
  background-color: ${colors.surface};
`;

const ExampleText = styled.Text`
  color: ${colors.ink};
  font-size: 13px;
  font-weight: 700;
`;

const History = styled.ScrollView`
  flex: 1;
`;

const Empty = styled.View`
  flex: 1;
  min-height: 250px;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 22px;
`;

const EmptyTitle = styled.Text`
  color: ${colors.ink};
  font-size: 20px;
  font-weight: 900;
  text-align: center;
`;

const EmptyText = styled.Text`
  color: ${colors.inkMuted};
  font-size: 14px;
  line-height: 20px;
  text-align: center;
`;

const Turn = styled.View`
  gap: 8px;
  margin-bottom: 12px;
`;

const Bubble = styled.View<{ $mine?: boolean }>`
  max-width: 92%;
  align-self: ${({ $mine }) => ($mine ? "flex-end" : "flex-start")};
  gap: 8px;
  padding: 12px 14px;
  border-radius: 8px;
  background-color: ${({ $mine }) => ($mine ? colors.brand : colors.surface)};
  border-width: ${({ $mine }) => ($mine ? 0 : 1)}px;
  border-color: ${colors.border};
`;

const BubbleText = styled.Text<{ $mine?: boolean }>`
  color: ${({ $mine }) => ($mine ? colors.white : colors.ink)};
  font-size: 15px;
  line-height: 21px;
`;

const Meta = styled.Text`
  color: ${colors.inkMuted};
  font-size: 11px;
  line-height: 16px;
`;

const Composer = styled.View`
  flex-direction: row;
  align-items: flex-end;
  gap: 8px;
  padding: 10px;
  border-width: 1px;
  border-color: ${colors.border};
  border-radius: 8px;
  background-color: ${colors.surface};
`;

const Input = styled.TextInput`
  flex: 1;
  min-height: 42px;
  max-height: 120px;
  color: ${colors.ink};
  font-size: 15px;
  line-height: 21px;
`;

const SendButton = styled(Pressable)<{ $enabled: boolean }>`
  width: 42px;
  height: 42px;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background-color: ${({ $enabled }) => ($enabled ? colors.brand : colors.border)};
`;

const DrawerBackdrop = styled(SafeAreaView)`
  flex: 1;
  flex-direction: row;
  background-color: ${colors.overlay};
`;

const DrawerPanel = styled.View`
  width: 82%;
  max-width: 320px;
  height: 100%;
  gap: 12px;
  padding: 16px;
  background-color: ${colors.surface};
`;

const DrawerHeader = styled.View`
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 8px;
  border-bottom-width: 1px;
  border-bottom-color: ${colors.border};
`;

const DrawerTitle = styled.Text`
  color: ${colors.ink};
  font-size: 17px;
  font-weight: 800;
`;

const examples = [
  "How many family members do I have?",
  "What did I discuss with John last week?",
  "Summarize my chats",
];

function generateConversationId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function generateTurnId(): string {
  return `${Date.now()}`;
}

function demoAnswer(question: string): AiTurn {
  return {
    id: generateTurnId(),
    question,
    answer:
      "In preview mode, I can show the AI chat flow. Real answers are generated from your MongoDB text messages after a premium account asks the backend.",
    textMessagesAnalyzed: 0,
    historyTruncated: false,
  };
}

export default function PrivateAiScreen() {
  const { width } = useWindowDimensions();
  const compact = width < 420;
  const wide = width >= 900;
  const { user, isDemo, refreshCurrentUser } = useAuth();
  const historyScrollRef = useRef<ScrollView>(null);
  const [question, setQuestion] = useState("");
  const [conversations, setConversations] = useState<StoredAiConversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [turns, setTurns] = useState<AiTurn[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ message: string; error?: boolean } | null>(null);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(true);
  const [premiumSummary, setPremiumSummary] = useState<PremiumRequestSummary | null>(null);
  const [premiumRequestBusy, setPremiumRequestBusy] = useState(false);

  const activeConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === activeConversationId),
    [activeConversationId, conversations],
  );

  useEffect(() => {
    if (!user || (!user.isPremium && !isDemo)) return;
    let mounted = true;
    void (isDemo
      ? loadAiConversations()
      : api.aiConversations().then((data) => data.conversations)
    )
      .then((items) => {
        if (!mounted) return;
        setConversations(items);
        if (items[0]) {
          setActiveConversationId(items[0].id);
          setTurns(items[0].turns);
        }
      })
      .catch((error) => {
        if (!mounted) return;
        setNotice({
          message:
            error instanceof ApiError
              ? error.message
              : "AI chat history could not be loaded.",
          error: true,
        });
      });
    return () => {
      mounted = false;
    };
  }, [isDemo, user]);

  useEffect(() => {
    if (!user || user.isPremium || isDemo) return;
    let mounted = true;
    const loadPremiumStatus = async () => {
      try {
        const summary = await api.premiumRequest();
        if (!mounted) return;
        setPremiumSummary(summary);
        if (summary.isPremium) await refreshCurrentUser();
      } catch {
        // The request button remains available if status refresh temporarily fails.
      }
    };
    void loadPremiumStatus();
    const interval = setInterval(() => void loadPremiumStatus(), 15000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [isDemo, refreshCurrentUser, user]);

  const locked = !user?.isPremium && !isDemo;

  const requestPremium = async () => {
    if (premiumRequestBusy) return;
    setPremiumRequestBusy(true);
    setNotice(null);
    try {
      const result = await api.requestPremium();
      setPremiumSummary((current) => ({
        isPremium: false,
        request: result.request,
        premiumCount: current?.premiumCount ?? 0,
        premiumLimit: current?.premiumLimit ?? 3,
      }));
    } catch (error) {
      setNotice({
        message: error instanceof ApiError ? error.message : "Premium request could not be sent.",
        error: true,
      });
    } finally {
      setPremiumRequestBusy(false);
    }
  };

  const scrollToBottom = (animated = true) => {
    setTimeout(() => {
      historyScrollRef.current?.scrollToEnd({ animated });
    }, 60);
  };

  const persistConversation = async (nextTurns: AiTurn[]) => {
    const now = new Date().toISOString();
    const existingId = activeConversationId ?? generateConversationId();
    const title = activeConversation?.title ?? nextTurns[0]?.question.slice(0, 48) ?? "New chat";
    const nextConversation: StoredAiConversation = {
      id: existingId,
      title,
      turns: nextTurns,
      createdAt: activeConversation?.createdAt ?? now,
      updatedAt: now,
    };
    const nextConversations = [
      nextConversation,
      ...conversations.filter((conversation) => conversation.id !== existingId),
    ];
    setActiveConversationId(existingId);
    setConversations(nextConversations);
    await saveAiConversations(nextConversations);
    scrollToBottom(true);
  };

  const startNewChat = () => {
    setActiveConversationId(null);
    setTurns([]);
    setQuestion("");
    setNotice(null);
    setMobileDrawerOpen(false);
  };

  const openConversation = (conversation: StoredAiConversation) => {
    setActiveConversationId(conversation.id);
    setTurns(conversation.turns);
    setQuestion("");
    setNotice(null);
    setMobileDrawerOpen(false);
    scrollToBottom(false);
  };

  const removeConversation = async (conversationId: string) => {
    if (isDemo) {
      const updated = await deleteAiConversation(conversationId);
      setConversations(updated);
      if (activeConversationId === conversationId) {
        if (updated[0]) {
          setActiveConversationId(updated[0].id);
          setTurns(updated[0].turns);
        } else {
          startNewChat();
        }
      }
      return;
    }

    try {
      await api.deleteAiConversation(conversationId);
    } catch (error) {
      setNotice({
        message:
          error instanceof ApiError
            ? error.message
            : "AI chat could not be deleted.",
        error: true,
      });
      return;
    }

    const updated = removeAiConversationFromList(conversations, conversationId);
    setConversations(updated);
    if (activeConversationId === conversationId) {
      if (updated[0]) {
        setActiveConversationId(updated[0].id);
        setTurns(updated[0].turns);
      } else {
        startNewChat();
      }
    }
  };

  const ask = async (value = question) => {
    const trimmed = value.trim();
    if (busy || trimmed.length < 2) return;
    setBusy(true);
    setNotice(null);
    setQuestion("");
    scrollToBottom(true);
    try {
      if (isDemo) {
        const nextTurns = [...turns, demoAnswer(trimmed)];
        setTurns(nextTurns);
        await persistConversation(nextTurns);
        return;
      }

      const reply = await api.askPrivateAi(
        trimmed,
        activeConversationId ?? undefined,
      );
      const conversation = reply.conversation;
      setActiveConversationId(conversation.id);
      setTurns(conversation.turns);
      setConversations((current) => upsertAiConversation(current, conversation));
      scrollToBottom(true);
    } catch (error) {
      setQuestion(trimmed);
      setNotice({
        message: error instanceof ApiError ? error.message : "Bondera AI could not answer right now.",
        error: true,
      });
    } finally {
      setBusy(false);
    }
  };


  const handleKeyPress = (event: { nativeEvent: { key?: string; shiftKey?: boolean } }) => {
    if (Platform.OS !== "web") return;
    if (event.nativeEvent.key === "Enter" && !event.nativeEvent.shiftKey) {
      void ask();
    }
  };

  const renderPastChats = () => (
    <PastChatList showsVerticalScrollIndicator={false}>
      {conversations.map((conversation) => (
        <PastChatItem key={conversation.id} $active={conversation.id === activeConversationId}>
          <PastChatSelectable onPress={() => openConversation(conversation)}>
            <PastChatTitle>{conversation.title}</PastChatTitle>
            <PastChatMeta>{conversation.turns.length} message{conversation.turns.length === 1 ? "" : "s"}</PastChatMeta>
          </PastChatSelectable>
          <IconButton
            icon={Trash2}
            label="Delete chat"
            tone="plain"
            color={colors.inkMuted}
            onPress={() => void removeConversation(conversation.id)}
          />
        </PastChatItem>
      ))}
      {!conversations.length ? (
        <PastChatMeta style={{ textAlign: "center", marginTop: 20 }}>No saved chats yet.</PastChatMeta>
      ) : null}
    </PastChatList>
  );

  if (!user) return <Redirect href="/login" />;

  return (
    <Screen>


      <Topbar $compact={compact}>
        <IconButton icon={ArrowLeft} label="Back" onPress={() => router.back()} />
        <IconButton
          icon={wide ? PanelLeft : HistoryIcon}
          label="Toggle chat history"
          tone="soft"
          onPress={() => (wide ? setDesktopSidebarOpen((prev) => !prev) : setMobileDrawerOpen(true))}
        />
        {!compact ? (
          <BrandMark>
            <Bot size={21} color={colors.white} />
          </BrandMark>
        ) : null}
        <TitleBlock>
          <Title>Private AI</Title>
          <Subtitle>{locked ? "Premium only" : "Chat data analyzer"}</Subtitle>
        </TitleBlock>
        <IconButton
          icon={MessageSquarePlus}
          label="New chat"
          tone="plain"
          onPress={startNewChat}
        />
      </Topbar>
      <Shell behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <Content $compact={compact}>
          {wide && desktopSidebarOpen ? (
            <Sidebar $visible={wide && desktopSidebarOpen}>
              <NewChatButton onPress={startNewChat}>
                <MessageSquarePlus size={17} color={colors.white} />
                <NewChatText>New chat</NewChatText>
              </NewChatButton>
              {renderPastChats()}
            </Sidebar>
          ) : null}
          <ChatPane>
            {notice ? <Notice {...notice} onClose={() => setNotice(null)} /> : null}
            {locked ? (
              <LockedPanel>
                <Sparkles size={26} color={colors.amber} />
                <LockedTitle>Premium required</LockedTitle>
                <LockedText>Private AI is available for premium accounts only.</LockedText>
                {premiumSummary?.request ? (
                  <PremiumStatus
                    $tone={
                      premiumSummary.request.status === "pending"
                        ? "pending"
                        : premiumSummary.request.status === "approved"
                          ? "plain"
                          : "error"
                    }
                  >
                    <PremiumStatusText
                      $tone={
                        premiumSummary.request.status === "pending"
                          ? "pending"
                          : premiumSummary.request.status === "approved"
                            ? "plain"
                            : "error"
                      }
                    >
                      {premiumSummary.request.status === "pending"
                        ? "Request pending · Admin review in progress"
                        : premiumSummary.request.status === "rejected"
                          ? "Request declined · You can request again"
                          : premiumSummary.request.status === "revoked"
                            ? "Premium access was removed"
                            : "Request approved · Updating access"}
                    </PremiumStatusText>
                  </PremiumStatus>
                ) : null}
                {premiumSummary?.request?.status !== "pending" ? (
                  <PremiumRequestButton
                    disabled={premiumRequestBusy}
                    onPress={() => void requestPremium()}
                    style={({ pressed }) => ({
                      opacity: pressed || premiumRequestBusy ? 0.72 : 1,
                    })}
                  >
                    {premiumRequestBusy ? (
                      <ActivityIndicator color={colors.white} />
                    ) : (
                      <PremiumRequestText>Request premium access</PremiumRequestText>
                    )}
                  </PremiumRequestButton>
                ) : null}
              </LockedPanel>
            ) : (
              <>
                {shouldShowAiSuggestions(turns.length, busy) ? (
                  <ExampleGrid>
                    {examples.map((item) => (
                      <Example key={item} onPress={() => void ask(item)}>
                        <ExampleText>{item}</ExampleText>
                      </Example>
                    ))}
                  </ExampleGrid>
                ) : null}
                <History
                  ref={historyScrollRef}
                  keyboardShouldPersistTaps="handled"
                  contentContainerStyle={{ flexGrow: 1, paddingVertical: 4 }}
                  onContentSizeChange={() => scrollToBottom(false)}
                >
                  {turns.length ? (
                    turns.map((turn) => (
                      <Turn key={turn.id}>
                        <Bubble $mine>
                          <BubbleText $mine>{turn.question}</BubbleText>
                        </Bubble>
                        <Bubble>
                          <BubbleText>{turn.answer}</BubbleText>
                          <Meta>
                            {turn.textMessagesAnalyzed} text messages analyzed
                            {turn.historyTruncated ? " · history truncated" : ""}
                          </Meta>
                        </Bubble>
                      </Turn>
                    ))
                  ) : (
                    <Empty>
                      <Bot size={34} color={colors.inkMuted} />
                      <EmptyTitle>Ask about your chats</EmptyTitle>
                      <EmptyText>Answers are based on your Bondera text messages and connections.</EmptyText>
                    </Empty>
                  )}
                </History>
                <Composer>
                  <Input
                    accessibilityLabel="Ask Private AI"
                    editable={!busy}
                    multiline
                    maxLength={1000}
                    placeholder="Ask Private AI (Enter to send, Shift+Enter for newline)"
                    placeholderTextColor={colors.inkMuted}
                    value={question}
                    onChangeText={setQuestion}
                    onKeyPress={handleKeyPress}
                  />
                  <SendButton
                    accessibilityRole="button"
                    accessibilityLabel="Send question"
                    disabled={busy || question.trim().length < 2}
                    $enabled={!busy && question.trim().length >= 2}
                    onPress={() => void ask()}
                  >
                    {busy ? <ActivityIndicator color={colors.white} /> : <Send size={19} color={colors.white} />}
                  </SendButton>
                </Composer>
              </>
            )}
          </ChatPane>
        </Content>
      </Shell>
      <Modal
        visible={mobileDrawerOpen}
        animationType="fade"
        transparent
        onRequestClose={() => setMobileDrawerOpen(false)}
      >
        <DrawerBackdrop>
          <DrawerPanel>
            <DrawerHeader>
              <DrawerTitle>Chat History</DrawerTitle>
              <IconButton icon={X} label="Close drawer" onPress={() => setMobileDrawerOpen(false)} />
            </DrawerHeader>
            <NewChatButton onPress={startNewChat}>
              <MessageSquarePlus size={17} color={colors.white} />
              <NewChatText>New chat</NewChatText>
            </NewChatButton>
            {renderPastChats()}
          </DrawerPanel>
          <Pressable style={{ flex: 1 }} onPress={() => setMobileDrawerOpen(false)} />
        </DrawerBackdrop>
      </Modal>
    </Screen>
  );
}

