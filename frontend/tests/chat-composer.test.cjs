const assert = require("node:assert/strict");
const test = require("node:test");

const {
  clampComposerInputHeight,
  insertTextAtSelection,
} = require("../node_modules/.cache/bondera-tests/services/chat-composer.js");

test("composer stays compact and grows only within its configured bounds", () => {
  assert.equal(clampComposerInputHeight(12, 34, 104), 34);
  assert.equal(clampComposerInputHeight(72.2, 34, 104), 73);
  assert.equal(clampComposerInputHeight(180, 34, 104), 104);
});

test("emoji text is inserted at the active selection without losing surrounding text", () => {
  assert.deepEqual(
    insertTextAtSelection("Hello world", { start: 6, end: 11 }, "👋", 4000),
    {
      value: "Hello 👋",
      selection: { start: 8, end: 8 },
    },
  );
});

test("emoji insertion respects the message length limit", () => {
  assert.equal(
    insertTextAtSelection("1234", { start: 4, end: 4 }, "😊", 5),
    undefined,
  );
});
