import * as Clipboard from "expo-clipboard";
import { Redirect, router, useFocusEffect } from "expo-router";
import {
  Bell,
  Bot,
  BriefcaseBusiness,
  Check,
  ChevronRight,
  Copy,
  House,
  LogOut,
  MessageCircleMore,
  MoreVertical,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  UsersRound,
  X,
} from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Modal, Pressable, RefreshControl, ScrollView, useWindowDimensions } from "react-native";
import { styled } from "styled-components/native";

import { Avatar } from "@/components/Avatar";
import { AccountProfileModal } from "@/components/AccountProfileModal";
import { BrandSymbol } from "@/components/BrandLogo";
import { CategoryModal } from "@/components/CategoryModal";
import { IconButton } from "@/components/IconButton";
import { Notice } from "@/components/Notice";
import { useAuth } from "@/context/AuthContext";
import { useNotification } from "@/context/NotificationContext";
import { demoCategories, demoIncoming, demoOutgoing, demoUncategorized } from "@/data/demo";
import { api, ApiError } from "@/services/api";
import {
  countUnreadConnections,
  setConnectionUnreadCount,
} from "@/services/read-state";
import { RealtimeClient } from "@/services/socket";

import { colors } from "@/theme";
import type { Category, Connection } from "@/types/api";
import { displayName, relativeTime } from "@/utils/format";

const Screen = styled.SafeAreaView`
  flex: 1;
  background-color: ${colors.canvas};
`;

const Topbar = styled.View`
  min-height: 68px;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  padding: 10px 20px;
  border-bottom-width: 1px;
  border-bottom-color: ${colors.border};
  background-color: ${colors.surface};
`;

const BrandRow = styled.View`
  flex-direction: row;
  align-items: center;
  gap: 10px;
`;

const BrandText = styled.Text`
  color: ${colors.ink};
  font-size: 21px;
  font-weight: 900;
`;

const TopActions = styled.View`
  flex-direction: row;
  align-items: center;
  gap: 4px;
`;

const NotificationAction = styled.View`
  position: relative;
`;

const NotificationBadge = styled.View`
  position: absolute;
  top: -4px;
  right: -4px;
  z-index: 1;
  min-width: 18px;
  height: 18px;
  align-items: center;
  justify-content: center;
  padding: 0 4px;
  border-width: 2px;
  border-color: ${colors.surface};
  border-radius: 9px;
  background-color: ${colors.coral};
`;

const NotificationBadgeText = styled.Text`
  color: ${colors.white};
  font-size: 9px;
  font-weight: 900;
`;

const Main = styled.View<{ $wide: boolean }>`
  width: 100%;
  max-width: 1120px;
  align-self: center;
  flex-direction: ${({ $wide }) => $wide ? "row" : "column"};
  gap: ${({ $wide }) => $wide ? 28 : 20}px;
  padding: ${({ $wide }) => $wide ? "28px 24px 48px" : "20px 16px 40px"};
`;

const Side = styled.View<{ $wide: boolean }>`
  width: ${({ $wide }) => $wide ? "344px" : "100%"};
  gap: 16px;
`;

const Content = styled.View`
  flex: 1;
  min-width: 0;
  gap: 18px;
`;

const SectionHeading = styled.View`
  gap: 3px;
`;

const Panel = styled.View`
  border-width: 1px;
  border-color: ${colors.border};
  border-radius: 8px;
  background-color: ${colors.surface};
  overflow: hidden;
`;

const PanelPad = styled.View`
  padding: 18px;
  gap: 14px;
`;

const PanelHeader = styled.View`
  min-height: 48px;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 14px;
  border-bottom-width: 1px;
  border-bottom-color: ${colors.border};
`;

const Heading = styled.Text`
  color: ${colors.ink};
  font-size: 18px;
  font-weight: 800;
`;

const Subheading = styled.Text`
  color: ${colors.inkMuted};
  font-size: 13px;
  line-height: 19px;
`;

const IdBox = styled.View`
  min-height: 58px;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 8px 8px 8px 14px;
  border-radius: 8px;
  background-color: ${colors.black};
`;

const IdText = styled.Text`
  flex: 1;
  color: ${colors.white};
  font-size: 20px;
  font-weight: 900;
  letter-spacing: 0px;
`;

const AccountRow = styled.View`
  min-height: 54px;
  flex-direction: row;
  align-items: center;
  gap: 12px;
`;

const AccountCopy = styled.View`
  flex: 1;
  min-width: 0;
  gap: 2px;
`;

const AccountName = styled.Text.attrs({ numberOfLines: 1 })`
  color: ${colors.ink};
  font-size: 16px;
  font-weight: 800;
`;

const AccountHandle = styled.Text.attrs({ numberOfLines: 1 })`
  color: ${colors.brand};
  font-size: 13px;
  font-weight: 700;
`;

const AccountEmail = styled.Text.attrs({ numberOfLines: 1 })`
  color: ${colors.inkMuted};
  font-size: 12px;
`;

const SearchBox = styled.View<{ $focused: boolean }>`
  min-height: 50px;
  flex-direction: row;
  align-items: center;
  gap: 9px;
  padding: 0 8px 0 13px;
  border-width: 1px;
  border-color: ${({ $focused }) => $focused ? colors.brand : colors.border};
  border-radius: 8px;
  background-color: ${colors.surface};
`;

const Input = styled.TextInput`
  flex: 1;
  min-width: 0;
  color: ${colors.ink};
  font-size: 15px;
  font-weight: 700;
  text-transform: uppercase;
`;

const SendButton = styled(Pressable)<{ $enabled: boolean }>`
  width: 38px;
  height: 38px;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background-color: ${({ $enabled }) => $enabled ? colors.brand : colors.border};
`;

const Tabs = styled.ScrollView`
  flex-grow: 0;
`;

const Tab = styled(Pressable)<{ $active: boolean }>`
  min-height: 38px;
  flex-direction: row;
  align-items: center;
  gap: 7px;
  padding: 8px 12px;
  border-width: 1px;
  border-color: ${({ $active }) => $active ? colors.brand : colors.border};
  border-radius: 8px;
  background-color: ${({ $active }) => $active ? colors.brandSoft : colors.surface};
`;

const TabText = styled.Text<{ $active: boolean }>`
  color: ${({ $active }) => $active ? colors.brandDark : colors.inkMuted};
  font-size: 13px;
  font-weight: 800;
`;

const Count = styled.View`
  min-width: 22px;
  height: 22px;
  align-items: center;
  justify-content: center;
  border-radius: 11px;
  background-color: ${colors.surfaceMuted};
`;

const CountText = styled.Text`
  color: ${colors.ink};
  font-size: 11px;
  font-weight: 800;
`;

const UnreadBadge = styled.View`
  min-width: 24px;
  height: 24px;
  align-items: center;
  justify-content: center;
  padding: 0 7px;
  border-radius: 12px;
  background-color: ${colors.brand};
`;

const UnreadText = styled.Text`
  color: ${colors.white};
  font-size: 11px;
  font-weight: 900;
`;

const List = styled.View`
  padding: 0 14px;
`;

const Row = styled.View`
  min-height: 74px;
  flex-direction: row;
  align-items: center;
  gap: 12px;
  border-bottom-width: 1px;
  border-bottom-color: ${colors.surfaceMuted};
`;

const ContactMain = styled(Pressable)`
  flex: 1;
  min-width: 0;
  min-height: 73px;
  flex-direction: row;
  align-items: center;
  gap: 12px;
`;

const RowBody = styled.View`
  flex: 1;
  min-width: 0;
  gap: 3px;
`;

const Name = styled.Text.attrs({ numberOfLines: 1 })`
  color: ${colors.ink};
  font-size: 15px;
  font-weight: 800;
`;

const Meta = styled.Text.attrs({ numberOfLines: 1 })`
  color: ${colors.inkMuted};
  font-size: 12px;
`;

const RowActions = styled.View`
  flex-direction: row;
  align-items: center;
  gap: 4px;
`;

const SmallButton = styled(Pressable)<{ $danger?: boolean; $primary?: boolean }>`
  min-height: 36px;
  padding: 7px 10px;
  align-items: center;
  justify-content: center;
  border-width: 1px;
  border-color: ${({ $danger, $primary }) => $danger ? colors.coral : $primary ? colors.brand : colors.border};
  border-radius: 8px;
  background-color: ${({ $danger, $primary }) => $danger ? colors.coralSoft : $primary ? colors.brand : colors.surface};
`;

const SmallButtonText = styled.Text<{ $danger?: boolean; $primary?: boolean }>`
  color: ${({ $danger, $primary }) => $danger ? colors.coral : $primary ? colors.white : colors.ink};
  font-size: 12px;
  font-weight: 800;
`;

const Empty = styled.View`
  min-height: 180px;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 28px;
`;

const EmptyText = styled.Text`
  color: ${colors.inkMuted};
  font-size: 14px;
  text-align: center;
`;

const ModalBackdrop = styled.View`
  flex: 1;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background-color: ${colors.overlay};
`;

const ActionDialog = styled.View`
  width: 100%;
  max-width: 400px;
  gap: 14px;
  padding: 20px;
  border-radius: 8px;
  background-color: ${colors.surface};
`;

const ActionTitleRow = styled.View`
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
`;

const ActionItem = styled(Pressable)<{ $danger?: boolean }>`
  min-height: 48px;
  flex-direction: row;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-width: 1px;
  border-color: ${({ $danger }) => $danger ? colors.coral : colors.border};
  border-radius: 8px;
  background-color: ${({ $danger }) => $danger ? colors.coralSoft : colors.surface};
`;

const ActionText = styled.Text<{ $danger?: boolean }>`
  color: ${({ $danger }) => $danger ? colors.coral : colors.ink};
  font-size: 14px;
  font-weight: 800;
`;

const categories: Category[] = ["Family", "Friends", "Professional"];
const categoryIcons = { Family: House, Friends: UsersRound, Professional: BriefcaseBusiness };
const emptyGroups = (): Record<Category, Connection[]> => ({
  Family: [], Friends: [], Professional: [],
});

export default function HomeScreen() {
  const { width } = useWindowDimensions();
  const wide = width >= 820;
  const { user, accessToken, isDemo, logout } = useAuth();
  const [realtime] = useState(() => new RealtimeClient());
  const [groups, setGroups] = useState<Record<Category, Connection[]>>(() => isDemo ? demoCategories : emptyGroups());
  const [uncategorized, setUncategorized] = useState<Connection[]>(() => isDemo ? demoUncategorized : []);
  const [incoming, setIncoming] = useState<Connection[]>(() => isDemo ? demoIncoming : []);
  const [outgoing, setOutgoing] = useState<Connection[]>(() => isDemo ? demoOutgoing : []);
  const [activeCategory, setActiveCategory] = useState<Category>("Family");
  const [target, setTarget] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ message: string; error?: boolean } | null>(null);
  const [categoryTarget, setCategoryTarget] = useState<Connection | null>(null);
  const [categoryChoice, setCategoryChoice] = useState<Category | undefined>();
  const [categoryMode, setCategoryMode] = useState<"accept" | "set">("set");
  const [actionTarget, setActionTarget] = useState<Connection | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const connectionsRef = useRef<Connection[]>([]);

  const load = useCallback(async () => {
    if (isDemo) {
      setGroups(demoCategories); setUncategorized(demoUncategorized);
      setIncoming(demoIncoming); setOutgoing(demoOutgoing); return;
    }
    const [contacts, requests] = await Promise.all([api.contacts(), api.requests()]);
    setGroups(contacts.categories); setUncategorized(contacts.uncategorized);
    setIncoming(requests.incoming); setOutgoing(requests.outgoing);
  }, [isDemo]);

  useFocusEffect(
    useCallback(() => {
      void load().catch((error) => {
        setNotice({
          message:
            error instanceof Error
              ? error.message
              : "Contacts could not be loaded.",
          error: true,
        });
      });
    }, [load]),
  );

  useEffect(() => {
    connectionsRef.current = [
      ...groups.Family,
      ...groups.Friends,
      ...groups.Professional,
      ...uncategorized,
    ];
  }, [groups, uncategorized]);

  const {
    isConnectionVisible,
    showAccountNotification,
    showNotification,
    showReactionNotification,
  } = useNotification();

  useEffect(() => {
    if (!accessToken || !user || isDemo) return;

    realtime.connect(accessToken, {
      onAccountBirthday: ({ title, body }) => showAccountNotification(title, body),
      onMessage: (message) => {
        if (message.senderId === user.id) return;
        const senderConn = connectionsRef.current.find(
          (c) => c.id === message.connectionId || c.otherUser.id === message.senderId,
        );
        const senderLabel = senderConn ? displayName(senderConn.otherUser) : "New message";

        if (isConnectionVisible(message.connectionId)) return;

        const touch = (items: Connection[]) => items.map((connection) =>
          connection.id === message.connectionId
            ? {
                ...connection,
                unreadCount: connection.unreadCount + 1,
                lastMessageAt: message.createdAt,
              }
            : connection
        );

        setGroups((current) => ({
          Family: touch(current.Family),
          Friends: touch(current.Friends),
          Professional: touch(current.Professional),
        }));
        setUncategorized((current) => touch(current));
        showNotification(message, senderLabel);
      },
      onEdited: () => undefined,
      onDelivered: () => undefined,
      onSeen: () => undefined,
      onUnreadCount: ({ connectionId, unreadCount }) => {
        setGroups((current) => ({
          Family: setConnectionUnreadCount(current.Family, connectionId, unreadCount),
          Friends: setConnectionUnreadCount(current.Friends, connectionId, unreadCount),
          Professional: setConnectionUnreadCount(
            current.Professional,
            connectionId,
            unreadCount,
          ),
        }));
        setUncategorized((current) =>
          setConnectionUnreadCount(current, connectionId, unreadCount),
        );
      },
      onReaction: ({ notification }) => {
        if (notification) showReactionNotification(notification);
      },
      onUnsent: () => undefined,
      onTyping: () => undefined,
    });

    return () => realtime.disconnect();
  }, [
    accessToken,
    isConnectionVisible,
    isDemo,
    realtime,
    showAccountNotification,
    showNotification,
    showReactionNotification,
    user,
  ]);


  const refresh = async () => {
    setRefreshing(true);
    try { await load(); } finally { setRefreshing(false); }
  };

  const openCategory = (connection: Connection, mode: "accept" | "set") => {
    setCategoryTarget(connection); setCategoryMode(mode); setCategoryChoice(connection.category);
  };

  const confirmCategory = async () => {
    if (!categoryTarget || !categoryChoice) return;
    setBusy(true);
    try {
      if (isDemo) {
        if (categoryMode === "accept") setIncoming((items) => items.filter((item) => item.id !== categoryTarget.id));
        setUncategorized((items) => items.filter((item) => item.id !== categoryTarget.id));
        setGroups((current) => {
          const cleaned = Object.fromEntries(categories.map((category) => [category, current[category].filter((item) => item.id !== categoryTarget.id)])) as Record<Category, Connection[]>;
          return { ...cleaned, [categoryChoice]: [...cleaned[categoryChoice], { ...categoryTarget, status: "accepted", category: categoryChoice, awaitingYourCategory: false, chatEnabled: true }] };
        });
      } else if (categoryMode === "accept") {
        await api.acceptRequest(categoryTarget.id, categoryChoice);
        await load();
      } else {
        await api.setCategory(categoryTarget.id, categoryChoice);
        await load();
      }
      setNotice({ message: `${displayName(categoryTarget.otherUser)} is now in ${categoryChoice}.` });
      setCategoryTarget(null);
    } catch (error) {
      setNotice({ message: error instanceof ApiError ? error.message : "Category could not be saved.", error: true });
    } finally { setBusy(false); }
  };

  const sendRequest = async () => {
    const normalized = target.trim().toUpperCase();
    if (!/^[A-Z0-9]{10}$/.test(normalized)) {
      setNotice({ message: "Bondera ID must be exactly 10 uppercase letters or numbers.", error: true }); return;
    }
    setBusy(true);
    try {
      if (!isDemo) await api.sendRequest(normalized);
      setTarget("");
      setNotice({ message: "Connection request sent." });
      if (!isDemo) await load();
    } catch (error) {
      setNotice({ message: error instanceof ApiError ? error.message : "Request could not be sent.", error: true });
    } finally { setBusy(false); }
  };

  const reject = async (connection: Connection) => {
    setBusy(true);
    try {
      if (!isDemo) await api.rejectRequest(connection.id);
      setIncoming((items) => items.filter((item) => item.id !== connection.id));
      setNotice({ message: "Connection request removed." });
    } catch (error) {
      setNotice({ message: error instanceof Error ? error.message : "Request could not be removed.", error: true });
    } finally { setBusy(false); }
  };

  const disconnect = async () => {
    if (!actionTarget) return;
    setBusy(true);
    try {
      if (!isDemo) await api.removeConnection(actionTarget.id);
      setGroups((current) => Object.fromEntries(categories.map((category) => [category, current[category].filter((item) => item.id !== actionTarget.id)])) as Record<Category, Connection[]>);
      setUncategorized((items) => items.filter((item) => item.id !== actionTarget.id));
      setNotice({ message: `${displayName(actionTarget.otherUser)} was disconnected.` });
      setActionTarget(null);
    } catch (error) {
      setNotice({ message: error instanceof Error ? error.message : "Contact could not be disconnected.", error: true });
    } finally { setBusy(false); }
  };

  const openChat = (connection: Connection) => {
    if (!connection.chatEnabled) { openCategory(connection, "set"); return; }
    router.push({ pathname: "/chat/[connectionId]", params: {
      connectionId: connection.id,
      userId: connection.otherUser.id,
      username: connection.otherUser.username,
      fullName: connection.otherUser.fullName ?? "",
      uniqueId: connection.otherUser.uniqueId,
      profilePicture: connection.otherUser.profilePicture?.url ?? "",
      category: connection.category ?? "",
    }});
  };

  const activeContacts = useMemo(() => groups[activeCategory] ?? [], [activeCategory, groups]);
  const unreadUserCount = useMemo(
    () => countUnreadConnections([
      ...groups.Family,
      ...groups.Friends,
      ...groups.Professional,
      ...uncategorized,
    ]),
    [groups, uncategorized],
  );
  if (!user) return <Redirect href="/login" />;

  return (
    <Screen>
      <Topbar>
        <BrandRow><BrandSymbol size={38} /><BrandText>Bondera</BrandText></BrandRow>
        <TopActions>
          <IconButton icon={Bot} label="Private AI" tone={user.isPremium || isDemo ? "soft" : "plain"} onPress={() => router.push("/ai")} />
          <IconButton icon={RefreshCw} label="Refresh" onPress={refresh} />
          <NotificationAction>
            <IconButton
              icon={Bell}
              label={`Notifications, ${unreadUserCount} unread ${unreadUserCount === 1 ? "chat" : "chats"}`}
              tone={incoming.length || unreadUserCount ? "soft" : "plain"}
            />
            {unreadUserCount > 0 ? (
              <NotificationBadge>
                <NotificationBadgeText>
                  {unreadUserCount > 99 ? "99+" : unreadUserCount}
                </NotificationBadgeText>
              </NotificationBadge>
            ) : null}
          </NotificationAction>
          <IconButton icon={LogOut} label="Sign out" onPress={async () => { await logout(); router.replace("/login"); }} />
        </TopActions>
      </Topbar>
      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.brand} />} contentContainerStyle={{ flexGrow: 1 }}>
        <Main $wide={wide}>
          <Side $wide={wide}>
            {notice ? <Notice {...notice} onClose={() => setNotice(null)} /> : null}
            <Panel><PanelPad>
              <AccountRow>
                <Avatar user={user} size={48} />
                <AccountCopy>
                  <AccountName>{user.fullName?.trim() || "Bondera user"}</AccountName>
                  <AccountHandle>@{user.username}</AccountHandle>
                  <AccountEmail>{user.email}</AccountEmail>
                </AccountCopy>
                <IconButton icon={Pencil} label="Edit account profile" onPress={() => setProfileOpen(true)} />
              </AccountRow>
            </PanelPad></Panel>
            <Panel><PanelPad>
              <Heading>Your Bondera ID</Heading>
              <Subheading>Share this ID with people you know.</Subheading>
              <IdBox>
                <IdText selectable>{user.uniqueId}</IdText>
                <IconButton icon={Copy} label="Copy Bondera ID" tone="soft" color={colors.white} onPress={async () => { await Clipboard.setStringAsync(user.uniqueId); setNotice({ message: "Bondera ID copied." }); }} />
              </IdBox>
            </PanelPad></Panel>
            <Panel><PanelPad>
              <Heading>Connect by ID</Heading>
              <SearchBox $focused={searchFocused}>
                <Search size={19} color={colors.inkMuted} />
                <Input
                  accessibilityLabel="Bondera ID"
                  autoCapitalize="characters"
                  maxLength={10}
                  value={target}
                  onChangeText={(value) => setTarget(value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase())}
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => setSearchFocused(false)}
                  onSubmitEditing={sendRequest}
                  placeholder="10-character ID"
                  placeholderTextColor={colors.inkMuted}
                />
                <SendButton accessibilityRole="button" accessibilityLabel="Send connection request" $enabled={target.length === 10} disabled={busy || target.length !== 10} onPress={sendRequest}>
                  {busy ? <ActivityIndicator size="small" color={colors.white} /> : <Plus size={20} color={colors.white} />}
                </SendButton>
              </SearchBox>
            </PanelPad></Panel>
            <Panel>
              <PanelHeader><Heading>Requests</Heading><Count><CountText>{incoming.length + outgoing.length}</CountText></Count></PanelHeader>
              <List>
                {incoming.map((connection) => (
                  <Row key={connection.id}>
                    <Avatar user={connection.otherUser} size={40} />
                    <RowBody><Name>{displayName(connection.otherUser)}</Name><Meta>Incoming · {relativeTime(connection.requestedAt)}</Meta></RowBody>
                    <RowActions>
                      <SmallButton $primary onPress={() => openCategory(connection, "accept")}><SmallButtonText $primary>Accept</SmallButtonText></SmallButton>
                      <IconButton icon={X} label="Reject request" tone="danger" onPress={() => reject(connection)} />
                    </RowActions>
                  </Row>
                ))}
                {outgoing.map((connection) => (
                  <Row key={connection.id}>
                    <Avatar user={connection.otherUser} size={40} />
                    <RowBody><Name>{displayName(connection.otherUser)}</Name><Meta>Awaiting response · {relativeTime(connection.requestedAt)}</Meta></RowBody>
                    <Check size={18} color={colors.inkMuted} />
                  </Row>
                ))}
                {!incoming.length && !outgoing.length ? <Empty><UsersRound size={26} color={colors.inkMuted} /><EmptyText>No pending requests</EmptyText></Empty> : null}
              </List>
            </Panel>
          </Side>
          <Content>
            <SectionHeading>
              <Heading>Your circles</Heading>
              <Subheading>{categories.reduce((sum, category) => sum + groups[category].length, 0)} contacts across three private groups</Subheading>
            </SectionHeading>
            {uncategorized.length ? (
              <Panel>
                <PanelHeader><Heading>Choose a category</Heading><Count><CountText>{uncategorized.length}</CountText></Count></PanelHeader>
                <List>{uncategorized.map((connection) => (
                  <Row key={connection.id}>
                    <Avatar user={connection.otherUser} />
                    <RowBody><Name>{displayName(connection.otherUser)}</Name><Meta>Chat is locked until you choose</Meta></RowBody>
                    <SmallButton $primary onPress={() => openCategory(connection, "set")}><SmallButtonText $primary>Choose</SmallButtonText></SmallButton>
                  </Row>
                ))}</List>
              </Panel>
            ) : null}
            <Tabs horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {categories.map((category) => {
                const Icon = categoryIcons[category];
                return <Tab key={category} $active={activeCategory === category} onPress={() => setActiveCategory(category)}><Icon size={16} color={activeCategory === category ? colors.brand : colors.inkMuted} /><TabText $active={activeCategory === category}>{category}</TabText><Count><CountText>{groups[category].length}</CountText></Count></Tab>;
              })}
            </Tabs>
            <Panel>
              <PanelHeader><Heading>{activeCategory}</Heading><Subheading>{activeContacts.length} contacts</Subheading></PanelHeader>
              <List>
                {activeContacts.map((connection) => (
                    <Row key={connection.id}>
                      <ContactMain accessibilityRole="button" onPress={() => openChat(connection)}>
                      <Avatar user={connection.otherUser} size={46} />
                      <RowBody><Name>{displayName(connection.otherUser)}</Name><Meta>@{connection.otherUser.username} · {connection.lastMessageAt ? relativeTime(connection.lastMessageAt) : connection.otherUser.uniqueId}</Meta></RowBody>
                      {connection.unreadCount ? <UnreadBadge><UnreadText>{connection.unreadCount > 99 ? "99+" : connection.unreadCount}</UnreadText></UnreadBadge> : null}
                      <ChevronRight size={20} color={colors.inkMuted} />
                      </ContactMain>
                      <IconButton icon={MoreVertical} label="Contact actions" onPress={() => setActionTarget(connection)} />
                    </Row>
                ))}
                {!activeContacts.length ? <Empty><MessageCircleMore size={28} color={colors.inkMuted} /><EmptyText>No contacts in {activeCategory}</EmptyText></Empty> : null}
              </List>
            </Panel>
          </Content>
        </Main>
      </ScrollView>
      <CategoryModal connection={categoryTarget} visible={Boolean(categoryTarget)} selected={categoryChoice} busy={busy} onSelect={setCategoryChoice} onConfirm={confirmCategory} onClose={() => !busy && setCategoryTarget(null)} />
      {profileOpen ? (
        <AccountProfileModal
          onClose={() => setProfileOpen(false)}
          onNotice={(message, error) => setNotice({ message, error })}
        />
      ) : null}
      <Modal transparent visible={Boolean(actionTarget)} animationType="fade" onRequestClose={() => setActionTarget(null)}>
        <ModalBackdrop><ActionDialog>
          <ActionTitleRow><Heading>{actionTarget ? displayName(actionTarget.otherUser) : "Contact"}</Heading><IconButton icon={X} label="Close" onPress={() => setActionTarget(null)} /></ActionTitleRow>
          <ActionItem onPress={() => { const current = actionTarget; setActionTarget(null); if (current) openCategory(current, "set"); }}><RefreshCw size={18} color={colors.ink} /><ActionText>Move to another circle</ActionText></ActionItem>
          <ActionItem $danger disabled={busy} onPress={disconnect}><Trash2 size={18} color={colors.coral} /><ActionText $danger>Disconnect contact</ActionText></ActionItem>
        </ActionDialog></ModalBackdrop>
      </Modal>
    </Screen>
  );
}
