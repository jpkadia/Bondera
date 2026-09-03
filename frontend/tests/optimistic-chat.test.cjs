const assert = require("node:assert/strict");
const test = require("node:test");

const {
  createOptimisticMessage,
  restoreOwnReaction,
  toggleOwnReaction,
} = require("../node_modules/.cache/bondera-tests/services/optimistic-chat.js");

test("outgoing message is renderable before the server acknowledgement", () => {
  const message = createOptimisticMessage({
    clientMessageId: "client-message-1",
    connectionId: "connection-1",
    senderId: "sender-1",
    recipientId: "recipient-1",
    text: "Instant hello",
    files: [],
    now: new Date("2026-09-03T10:00:00.000Z"),
  });

  assert.equal(message.id, "pending:client-message-1");
  assert.equal(message.text, "Instant hello");
  assert.equal(message.pending, true);
  assert.equal(message.kind, "text");
});

test("optimistic media preserves local previews until upload completes", () => {
  const message = createOptimisticMessage({
    clientMessageId: "client-message-2",
    connectionId: "connection-1",
    senderId: "sender-1",
    recipientId: "recipient-1",
    files: [{
      uri: "file:///photo.jpg",
      name: "photo.jpg",
      mimeType: "image/jpeg",
      size: 123,
    }],
  });

  assert.equal(message.kind, "media");
  assert.equal(message.media[0].url, "file:///photo.jpg");
  assert.equal(message.media[0].resourceType, "image");
});

test("reaction tap updates immediately and toggles the current user's emoji", () => {
  const initial = [{
    userId: "another-user",
    emoji: "👍",
    reactedAt: "2026-09-03T10:00:00.000Z",
  }];
  const added = toggleOwnReaction(
    initial,
    "current-user",
    "❤",
    new Date("2026-09-03T10:01:00.000Z"),
  );
  assert.deepEqual(added.map((reaction) => reaction.emoji), ["👍", "❤"]);
  assert.deepEqual(toggleOwnReaction(added, "current-user", "❤"), initial);
});

test("failed optimistic reaction rollback preserves newer reactions from others", () => {
  const previous = [{
    userId: "current-user",
    emoji: "❤",
    reactedAt: "2026-09-03T10:00:00.000Z",
  }];
  const current = [{
    userId: "another-user",
    emoji: "😂",
    reactedAt: "2026-09-03T10:01:00.000Z",
  }];

  assert.deepEqual(
    restoreOwnReaction(current, previous, "current-user").map(
      (reaction) => reaction.emoji,
    ),
    ["😂", "❤"],
  );
});
