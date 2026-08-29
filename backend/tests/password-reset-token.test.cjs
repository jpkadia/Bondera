const assert = require("node:assert/strict");
const test = require("node:test");

const {
  createPasswordResetToken,
  hashPasswordResetToken,
} = require("../node_modules/.cache/bondera-tests/passwordResetToken.js");

test("password reset tokens contain at least 256 bits of random material", () => {
  const first = createPasswordResetToken();
  const second = createPasswordResetToken();

  assert.ok(first.length >= 43);
  assert.notEqual(first, second);
});

test("only a deterministic SHA-256 digest needs database storage", () => {
  const token = createPasswordResetToken();
  const digest = hashPasswordResetToken(token);

  assert.match(digest, /^[a-f0-9]{64}$/);
  assert.equal(hashPasswordResetToken(token), digest);
  assert.notEqual(hashPasswordResetToken(`${token}x`), digest);
});
