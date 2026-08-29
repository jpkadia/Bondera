import type { Category, ChatMessage, Connection, User } from "@/types/api";

const now = Date.now();

export const demoUser: User = {
  id: "64d000000000000000000001",
  email: "preview@bondera.local",
  username: "parth",
  fullName: "Parth Kadiya",
  birthDate: "1995-01-01",
  uniqueId: "BONDERA612",
  isPremium: true,
};

const contact = (
  id: string,
  username: string,
  fullName: string,
  uniqueId: string,
  category?: Category,
  overrides: Partial<Connection> = {},
): Connection => ({
  id,
  status: "accepted",
  direction: "outgoing",
  category,
  chatEnabled: Boolean(category),
  awaitingYourCategory: !category,
  awaitingOtherCategory: false,
  requestedAt: new Date(now - 9 * 86400000).toISOString(),
  lastMessageAt: new Date(now - 22 * 60000).toISOString(),
  unreadCount: 1,
  otherUser: { id: `${id.slice(0, 22)}99`, username, fullName, uniqueId },
  ...overrides,
});

export const demoCategories: Record<Category, Connection[]> = {
  Family: [contact("64d000000000000000000011", "anaya", "Anaya Kadiya", "ANAYA8K2Q1", "Family")],
  Friends: [contact("64d000000000000000000012", "ishan", "Ishan Mehta", "ISHAN40L7P", "Friends")],
  Professional: [contact("64d000000000000000000013", "nira", "Nira Shah", "NIRASH8D21", "Professional")],
};

export const demoIncoming: Connection[] = [
  contact("64d000000000000000000014", "rohan", "Rohan Desai", "ROHAN3F81J", undefined, {
    status: "pending",
    direction: "incoming",
    chatEnabled: false,
    awaitingYourCategory: false,
    requestedAt: new Date(now - 35 * 60000).toISOString(),
  }),
];

export const demoOutgoing: Connection[] = [
  contact("64d000000000000000000015", "meera", "Meera Joshi", "MEERA5D9X2", undefined, {
    status: "pending",
    direction: "outgoing",
    chatEnabled: false,
    awaitingYourCategory: false,
    requestedAt: new Date(now - 2 * 86400000).toISOString(),
  }),
];

export const demoUncategorized: Connection[] = [
  contact("64d000000000000000000016", "dev", "Dev Patel", "DEVPAT9C20", undefined, {
    direction: "outgoing",
    awaitingYourCategory: true,
    awaitingOtherCategory: false,
  }),
];

export function demoMessages(connection: Connection): ChatMessage[] {
  const you = demoUser.id;
  const them = connection.otherUser.id;
  return [
    {
      id: "64e000000000000000000001",
      connectionId: connection.id,
      senderId: them,
      recipientId: you,
      text: "The plan is set for Saturday. I will send the address tonight.",
      media: [], kind: "text", reactions: [],
      receipts: [{ userId: you, deliveredAt: new Date(now - 46 * 60000).toISOString(), seenAt: new Date(now - 45 * 60000).toISOString() }],
      isDeleted: false,
      createdAt: new Date(now - 47 * 60000).toISOString(),
      updatedAt: new Date(now - 47 * 60000).toISOString(),
    },
    {
      id: "64e000000000000000000002",
      connectionId: connection.id,
      senderId: you,
      recipientId: them,
      text: "Perfect. I will keep the afternoon free.",
      media: [], kind: "text", reactions: [{ userId: them, emoji: "❤", reactedAt: new Date(now - 31 * 60000).toISOString() }],
      receipts: [{ userId: them, deliveredAt: new Date(now - 32 * 60000).toISOString(), seenAt: new Date(now - 30 * 60000).toISOString() }],
      isDeleted: false,
      createdAt: new Date(now - 33 * 60000).toISOString(),
      updatedAt: new Date(now - 30 * 60000).toISOString(),
    },
    {
      id: "64e000000000000000000003",
      connectionId: connection.id,
      senderId: them,
      recipientId: you,
      text: "Done. See you then!",
      media: [], kind: "text", reactions: [],
      receipts: [{ userId: you, deliveredAt: new Date(now - 22 * 60000).toISOString() }],
      isDeleted: false,
      createdAt: new Date(now - 22 * 60000).toISOString(),
      updatedAt: new Date(now - 22 * 60000).toISOString(),
    },
  ];
}
