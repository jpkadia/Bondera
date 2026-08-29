const assert = require("node:assert/strict");
const test = require("node:test");

const {
  reactionMessagePreview,
  shouldNotifyMessageOwnerOfReaction,
} = require("../node_modules/.cache/bondera-tests/reactionNotification.js");

test("only a newly added reaction from another user notifies the message owner", () => {
  assert.equal(shouldNotifyMessageOwnerOfReaction("reactor", "owner", true), true);
  assert.equal(shouldNotifyMessageOwnerOfReaction("owner", "owner", true), false);
  assert.equal(shouldNotifyMessageOwnerOfReaction("reactor", "owner", false), false);
});

test("reaction notification preview is meaningful and safely bounded", () => {
  assert.equal(reactionMessagePreview("  Hello there  ", 0), "Hello there");
  assert.equal(reactionMessagePreview(undefined, 1), "Photo or attachment");
  assert.equal(reactionMessagePreview(undefined, 3), "3 attachments");
  assert.equal(reactionMessagePreview("x".repeat(100), 0).length, 80);
});
