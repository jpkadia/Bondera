const test = require("node:test");
const assert = require("node:assert/strict");

const {
  shouldShowMessageAction,
} = require("../node_modules/.cache/bondera-tests/services/message-actions.js");

test("message action is visible while an eligible web message shell is hovered", () => {
  assert.equal(
    shouldShowMessageAction({
      isWeb: true,
      isHovered: true,
      isDeleted: false,
      isPending: false,
    }),
    true,
  );
});

test("message action stays hidden outside supported and actionable states", () => {
  const eligible = {
    isWeb: true,
    isHovered: true,
    isDeleted: false,
    isPending: false,
  };

  for (const override of [
    { isWeb: false },
    { isHovered: false },
    { isDeleted: true },
    { isPending: true },
  ]) {
    assert.equal(shouldShowMessageAction({ ...eligible, ...override }), false);
  }
});
