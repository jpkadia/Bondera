const assert = require("node:assert/strict");
const test = require("node:test");

const {
  hasPremiumCapacity,
} = require("../node_modules/.cache/bondera-tests/premiumCapacity.js");

test("allows the first three premium slots and blocks every fourth grant", () => {
  assert.equal(hasPremiumCapacity(0, 3), true);
  assert.equal(hasPremiumCapacity(2, 3), true);
  assert.equal(hasPremiumCapacity(3, 3), false);
  assert.equal(hasPremiumCapacity(4, 3), false);
});
