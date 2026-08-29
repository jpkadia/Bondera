const assert = require("node:assert/strict");
const test = require("node:test");

const {
  isValidBirthDate,
  toIsoBirthDate,
} = require("../node_modules/.cache/bondera-tests/birthDate.js");

const now = new Date("2026-08-26T12:00:00.000Z");

test("complete calendar dates convert to timezone-safe ISO birthdates", () => {
  assert.equal(
    toIsoBirthDate({ year: 2000, month: 2, day: 29 }, now),
    "2000-02-29",
  );
});

test("partial, impossible, too-old and future birthdates are rejected", () => {
  assert.equal(toIsoBirthDate({ month: 2, day: 4 }, now), undefined);
  assert.equal(toIsoBirthDate({ year: 2001, month: 2, day: 29 }, now), undefined);
  assert.equal(toIsoBirthDate({ year: 1899, month: 1, day: 1 }, now), undefined);
  assert.equal(toIsoBirthDate({ year: 2027, month: 1, day: 1 }, now), undefined);
});

test("stored values require canonical YYYY-MM-DD format", () => {
  assert.equal(isValidBirthDate("1998-12-31", now), true);
  assert.equal(isValidBirthDate("31/12/1998", now), false);
  assert.equal(isValidBirthDate("1998-02-30", now), false);
});
