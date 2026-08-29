const assert = require("node:assert/strict");
const test = require("node:test");

const {
  validateLoginValues,
  validateOtp,
  validateSignupValues,
} = require("../node_modules/.cache/bondera-tests/services/auth-validation.js");

test("login validation reports field-specific identifier and password errors", () => {
  assert.deepEqual(validateLoginValues({ identifier: "bad@", password: "" }), {
    identifier: "Enter a valid email address.",
    password: "Password is required.",
  });
});

test("login rejects malformed usernames before making a request", () => {
  assert.equal(
    validateLoginValues({ identifier: "bad user", password: "Password@1" }).identifier,
    "Enter a valid email address or username.",
  );
});

test("signup validation reports every invalid field in one pass", () => {
  const errors = validateSignupValues({
    fullName: "x".repeat(81),
    username: "bad name",
    email: "invalid",
    birthDateText: "31/02/2020",
    password: "weak",
    confirmPassword: "different",
  });
  assert.ok(errors.fullName);
  assert.ok(errors.username);
  assert.ok(errors.email);
  assert.ok(errors.birthDateText);
  assert.ok(errors.password);
  assert.ok(errors.confirmPassword);
});

test("normal signup requires a full name", () => {
  const errors = validateSignupValues({
    fullName: "",
    username: "parth.612",
    email: "parth@example.com",
    birthDateText: "12/09/1998",
    password: "Strong@1",
    confirmPassword: "Strong@1",
  });
  assert.equal(errors.fullName, "Full name is required.");
});

test("valid signup details and six digit OTP pass", () => {
  assert.deepEqual(validateSignupValues({
    fullName: "Parth Kadiya",
    username: "parth.612",
    email: "parth@example.com",
    birthDateText: "12/09/1998",
    password: "Strong@1",
    confirmPassword: "Strong@1",
  }), {});
  assert.equal(validateOtp("123456"), undefined);
});
