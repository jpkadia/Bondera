const assert = require("node:assert/strict");
const test = require("node:test");

const {
  birthdayDueAtLocalMidnight,
  birthdayMessageClientId,
  isValidTimeZone,
  localDateTimeParts,
} = require("../node_modules/.cache/bondera-tests/birthdayAutomation.js");

test("detects a birthday only during the user's local midnight hour", () => {
  const atMidnightInKolkata = new Date("2026-09-12T18:30:20.000Z");
  assert.equal(
    birthdayDueAtLocalMidnight("1998-09-13", "Asia/Kolkata", atMidnightInKolkata)?.localDate,
    "2026-09-13",
  );
  assert.equal(
    birthdayDueAtLocalMidnight("1998-09-13", "UTC", atMidnightInKolkata),
    undefined,
  );
});

test("timezone conversion remains correct across the international date line", () => {
  const instant = new Date("2026-01-01T10:15:00.000Z");
  assert.deepEqual(localDateTimeParts(instant, "Pacific/Kiritimati"), {
    year: 2026,
    month: 1,
    day: 2,
    hour: 0,
    minute: 15,
    localDate: "2026-01-02",
  });
  assert.equal(isValidTimeZone("Not/A_Timezone"), false);
});

test("birthday message ids are deterministic for retry idempotency", () => {
  assert.equal(
    birthdayMessageClientId("user-123", "2026-09-13"),
    "birthday:2026-09-13:user-123",
  );
});
