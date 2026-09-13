const assert = require("node:assert/strict");
const test = require("node:test");

const {
  AI_CHAT_CACHE_TTL_MS,
  clearAiChatSnapshots,
  getAiChatSnapshot,
  isAiChatSnapshotFresh,
  setAiChatSnapshot,
} = require("../node_modules/.cache/bondera-tests/services/ai-chat-cache.js");

test("AI chat snapshot restores the last conversation without another visible load", () => {
  clearAiChatSnapshots();
  const conversations = [{
    id: "ai-1",
    title: "Family summary",
    turns: [],
    createdAt: "2026-09-13T10:00:00.000Z",
    updatedAt: "2026-09-13T10:00:00.000Z",
  }];
  setAiChatSnapshot("user-1", {
    conversations,
    activeConversationId: "ai-1",
    turns: [],
  }, 1_000);

  const snapshot = getAiChatSnapshot("user-1");
  assert.equal(snapshot?.activeConversationId, "ai-1");
  assert.deepEqual(snapshot?.conversations, conversations);
  assert.equal(isAiChatSnapshotFresh(snapshot, 1_001), true);
});

test("AI chat snapshot becomes stale after the bounded cache window", () => {
  clearAiChatSnapshots();
  setAiChatSnapshot("user-1", {
    conversations: [],
    activeConversationId: null,
    turns: [],
  }, 1_000);

  const snapshot = getAiChatSnapshot("user-1");
  assert.ok(snapshot);
  assert.equal(
    isAiChatSnapshotFresh(snapshot, 1_000 + AI_CHAT_CACHE_TTL_MS),
    false,
  );
});
