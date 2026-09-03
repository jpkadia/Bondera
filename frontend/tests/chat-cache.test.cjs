const assert = require("node:assert/strict");
const test = require("node:test");

const {
  clearChatSnapshots,
  getChatSnapshot,
  setChatSnapshot,
} = require("../node_modules/.cache/bondera-tests/services/chat-cache.js");

const connection = {
  id: "connection-1",
  status: "accepted",
  direction: "outgoing",
  chatEnabled: true,
  awaitingYourCategory: false,
  awaitingOtherCategory: false,
  requestedAt: "2026-09-03T10:00:00.000Z",
  unreadCount: 0,
  otherUser: { id: "user-2", username: "friend", uniqueId: "ABCDEFGHIJ" },
};

test("recent chat snapshot is available immediately on revisit", () => {
  clearChatSnapshots();
  setChatSnapshot("connection-1", {
    connection,
    messages: [],
    firstUnreadMessageId: null,
    nextAfterCursor: null,
  });

  assert.equal(getChatSnapshot("connection-1")?.connection.id, "connection-1");
});

test("chat cache is bounded by conversation count", () => {
  clearChatSnapshots();
  for (let index = 0; index < 13; index += 1) {
    setChatSnapshot(`connection-${index}`, {
      connection: { ...connection, id: `connection-${index}` },
      messages: [],
      firstUnreadMessageId: null,
      nextAfterCursor: null,
    });
  }

  assert.equal(getChatSnapshot("connection-0"), undefined);
  assert.ok(getChatSnapshot("connection-12"));
});

test("unconfirmed optimistic messages are never restored as sent", () => {
  clearChatSnapshots();
  setChatSnapshot("connection-1", {
    connection,
    messages: [
      {
        id: "pending:local-1",
        connectionId: "connection-1",
        senderId: "user-1",
        recipientId: "user-2",
        kind: "text",
        text: "Still sending",
        media: [],
        reactions: [],
        receipts: [],
        isDeleted: false,
        pending: true,
        createdAt: "2026-09-03T10:00:00.000Z",
        updatedAt: "2026-09-03T10:00:00.000Z",
      },
    ],
    firstUnreadMessageId: null,
    nextAfterCursor: null,
  });

  assert.deepEqual(getChatSnapshot("connection-1")?.messages, []);
});
