const assert = require("node:assert/strict");
const test = require("node:test");

const {
  canAcknowledgeSeen,
  countUnreadConnections,
  findFirstUnreadIndex,
  latestSeenAt,
  latestViewableUnreadMessage,
  setConnectionUnreadCount,
} = require("../node_modules/.cache/bondera-tests/services/read-state.js");

const message = (overrides = {}) => ({
  id: "message-1",
  connectionId: "connection-1",
  senderId: "sender-1",
  recipientId: "recipient-1",
  text: "hello",
  media: [],
  kind: "text",
  reactions: [],
  receipts: [{ userId: "recipient-1" }],
  isDeleted: false,
  createdAt: "2026-08-26T10:00:00.000Z",
  updatedAt: "2026-08-26T10:00:00.000Z",
  ...overrides,
});

test("seen acknowledgement requires focused, foreground, visible UI", () => {
  assert.equal(
    canAcknowledgeSeen({
      isRouteFocused: true,
      isAppActive: true,
      isDocumentVisible: true,
    }),
    true,
  );

  for (const hiddenState of [
    { isRouteFocused: false, isAppActive: true, isDocumentVisible: true },
    { isRouteFocused: true, isAppActive: false, isDocumentVisible: true },
    { isRouteFocused: true, isAppActive: true, isDocumentVisible: false },
  ]) {
    assert.equal(canAcknowledgeSeen(hiddenState), false);
  }
});

test("first unread anchor resolves without falling through to chat bottom", () => {
  const messages = [
    { id: "read-1" },
    { id: "first-unread" },
    { id: "unread-2" },
  ];

  assert.equal(findFirstUnreadIndex(messages, "first-unread"), 1);
  assert.equal(findFirstUnreadIndex(messages, null), -1);
  assert.equal(findFirstUnreadIndex(messages, "not-in-page"), -1);
});

test("only the latest actually viewable incoming unread message is selected", () => {
  const messages = [
    message({ id: "old-visible" }),
    message({ id: "already-seen", receipts: [{ userId: "recipient-1", seenAt: "2026-08-26T10:01:00.000Z" }] }),
    message({ id: "outgoing", senderId: "recipient-1" }),
    message({ id: "new-visible", createdAt: "2026-08-26T10:03:00.000Z" }),
    message({ id: "not-visible", createdAt: "2026-08-26T10:04:00.000Z" }),
  ];

  assert.equal(
    latestViewableUnreadMessage(
      messages,
      new Set(["old-visible", "already-seen", "outgoing", "new-visible"]),
      "sender-1",
    )?.id,
    "new-visible",
  );
});

test("deleted, optimistic and non-viewable messages never become seen candidates", () => {
  const messages = [
    message({ id: "deleted", isDeleted: true }),
    message({ id: "pending", pending: true }),
    message({ id: "hidden" }),
  ];

  assert.equal(
    latestViewableUnreadMessage(
      messages,
      new Set(["deleted", "pending"]),
      "sender-1",
    ),
    undefined,
  );
});

test("server unread count replaces stale local count and is clamped at zero", () => {
  const connections = [
    { id: "connection-1", unreadCount: 4 },
    { id: "connection-2", unreadCount: 2 },
  ];

  const updated = setConnectionUnreadCount(connections, "connection-1", 0);
  assert.equal(updated[0].unreadCount, 0);
  assert.equal(updated[1].unreadCount, 2);
  assert.equal(setConnectionUnreadCount(updated, "connection-1", -5)[0].unreadCount, 0);
});

test("notification count represents unique users with unread messages", () => {
  assert.equal(
    countUnreadConnections([
      { id: "connection-1", unreadCount: 4 },
      { id: "connection-2", unreadCount: 1 },
      { id: "connection-3", unreadCount: 0 },
      { id: "connection-1", unreadCount: 4 },
    ]),
    2,
  );
});

test("latest seen receipt timestamp ignores missing and invalid values", () => {
  assert.equal(
    latestSeenAt([
      {},
      { seenAt: "invalid" },
      { seenAt: "2026-08-29T07:00:00.000Z" },
      { seenAt: "2026-08-29T07:35:00.000Z" },
    ]),
    "2026-08-29T07:35:00.000Z",
  );
});
