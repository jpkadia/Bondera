const assert = require("node:assert/strict");
const test = require("node:test");

const {
  chatDateLabel,
  isSameCalendarDay,
  seenReceiptLabel,
  seenTime,
} = require("../node_modules/.cache/bondera-tests/utils/format.js");

test("seen receipt time uses a stable 12-hour clock with AM or PM", () => {
  const localSeenAt = new Date(2026, 7, 29, 13, 5).toISOString();
  assert.equal(seenTime(localSeenAt), "01:05 PM");
});

test("chat dates use Today, Yesterday, then the full calendar date", () => {
  const now = new Date(2026, 7, 29, 18, 30);

  assert.equal(chatDateLabel(new Date(2026, 7, 29, 8, 0).toISOString(), now), "Today");
  assert.equal(chatDateLabel(new Date(2026, 7, 28, 23, 59).toISOString(), now), "Yesterday");
  assert.equal(
    chatDateLabel(new Date(2026, 7, 27, 12, 0).toISOString(), now),
    "August 27, 2026",
  );
});

test("message grouping compares local calendar dates instead of elapsed hours", () => {
  assert.equal(
    isSameCalendarDay(
      new Date(2026, 7, 29, 0, 1).toISOString(),
      new Date(2026, 7, 29, 23, 59).toISOString(),
    ),
    true,
  );
  assert.equal(
    isSameCalendarDay(
      new Date(2026, 7, 28, 23, 59).toISOString(),
      new Date(2026, 7, 29, 0, 1).toISOString(),
    ),
    false,
  );
});

test("seen receipt is time-only today, Yesterday for yesterday, then a date", () => {
  const now = new Date(2026, 7, 29, 18, 30);

  assert.equal(
    seenReceiptLabel(new Date(2026, 7, 29, 13, 5).toISOString(), now),
    "Seen at 01:05 PM",
  );
  assert.equal(
    seenReceiptLabel(new Date(2026, 7, 28, 23, 59).toISOString(), now),
    "Seen Yesterday",
  );
  assert.equal(
    seenReceiptLabel(new Date(2026, 7, 27, 12, 0).toISOString(), now),
    "Seen August 27, 2026",
  );
});
