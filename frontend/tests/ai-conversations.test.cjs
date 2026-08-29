const assert = require("node:assert/strict");
const test = require("node:test");

const {
  removeAiConversation,
  shouldShowAiSuggestions,
  upsertAiConversation,
} = require("../node_modules/.cache/bondera-tests/services/ai-conversations.js");

test("server-authoritative AI conversation replaces stale local copy", () => {
  const oldConversation = { id: "a", turns: [{ id: "old" }] };
  const otherConversation = { id: "b", turns: [] };
  const savedConversation = { id: "a", turns: [{ id: "old" }, { id: "new" }] };

  const result = upsertAiConversation(
    [otherConversation, oldConversation],
    savedConversation,
  );

  assert.deepEqual(result, [savedConversation, otherConversation]);
});

test("deleting an AI conversation removes only the owned selected item", () => {
  assert.deepEqual(
    removeAiConversation([{ id: "a" }, { id: "b" }], "a"),
    [{ id: "b" }],
  );
});

test("AI suggestions are visible only before the first question is sent", () => {
  assert.equal(shouldShowAiSuggestions(0, false), true);
  assert.equal(shouldShowAiSuggestions(0, true), false);
  assert.equal(shouldShowAiSuggestions(1, false), false);
});
