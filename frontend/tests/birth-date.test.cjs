const assert = require("node:assert/strict");
const test = require("node:test");

const {
  formatIsoBirthDate,
  normalizeBirthDateText,
  parseBirthDateText,
} = require("../node_modules/.cache/bondera-tests/services/birth-date.js");

const today = new Date(2026, 7, 26, 12);

test("birthdate typing is normalized into DD/MM/YYYY", () => {
  assert.equal(normalizeBirthDateText("29a02-2000"), "29/02/2000");
  assert.equal(normalizeBirthDateText("0101"), "01/01");
});

test("valid DD/MM/YYYY input converts to a date-only ISO value", () => {
  assert.equal(parseBirthDateText("29/02/2000", today), "2000-02-29");
  assert.equal(formatIsoBirthDate("2000-02-29"), "29/02/2000");
});

test("impossible, incomplete, too-old and future birthdates are rejected", () => {
  assert.equal(parseBirthDateText("29/02/2001", today), undefined);
  assert.equal(parseBirthDateText("01/01", today), undefined);
  assert.equal(parseBirthDateText("31/12/1899", today), undefined);
  assert.equal(parseBirthDateText("01/01/2027", today), undefined);
});
