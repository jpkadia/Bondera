const assert = require("node:assert/strict");
const test = require("node:test");

const {
  TypingSignalController,
} = require("../node_modules/.cache/bondera-tests/services/typing-state.js");

const wait = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

test("typing signal starts once and stops after inactivity", async () => {
  const events = [];
  const controller = new TypingSignalController(
    (active) => events.push(active),
    20,
  );

  controller.update("H");
  controller.update("He");
  controller.update("Hello");
  assert.deepEqual(events, [true]);

  await wait(35);
  assert.deepEqual(events, [true, false]);
});

test("empty input and disposal stop an active typing signal exactly once", () => {
  const events = [];
  const controller = new TypingSignalController(
    (active) => events.push(active),
    1_000,
  );

  controller.update("Typing");
  controller.update("   ");
  controller.dispose();

  assert.deepEqual(events, [true, false]);
});

test("continuous typing refreshes the remote indicator before it can become stale", async () => {
  const events = [];
  const controller = new TypingSignalController(
    (active) => events.push(active),
    100,
    12,
  );

  controller.update("A");
  await wait(18);
  controller.update("Active typing");
  await wait(28);

  assert.ok(events.filter((active) => active).length >= 3);
  assert.equal(events.includes(false), false);

  controller.stop();
  assert.equal(events.at(-1), false);
});
