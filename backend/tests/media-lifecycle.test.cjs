const assert = require("node:assert/strict");
const test = require("node:test");

const {
  cleanupResourceType,
  cleanupRetryDelayMs,
  isGoogleProfilePictureUrl,
  shouldHydrateGoogleProfilePicture,
} = require("../node_modules/.cache/bondera-tests/mediaLifecycle.js");

test("Cloudinary deletion uses the original explicit resource type", () => {
  assert.equal(
    cleanupResourceType({ resourceType: "raw", mimeType: "image/png" }),
    "raw",
  );
});

test("automatic media types map images, audio/video, and documents correctly", () => {
  assert.equal(
    cleanupResourceType({ resourceType: "auto", mimeType: "image/jpeg" }),
    "image",
  );
  assert.equal(
    cleanupResourceType({ resourceType: "auto", mimeType: "audio/mpeg" }),
    "video",
  );
  assert.equal(
    cleanupResourceType({ resourceType: "auto", mimeType: "video/mp4" }),
    "video",
  );
  assert.equal(
    cleanupResourceType({ resourceType: "auto", mimeType: "application/pdf" }),
    "raw",
  );
});

test("cleanup retry uses bounded exponential backoff", () => {
  assert.equal(cleanupRetryDelayMs(1), 30_000);
  assert.equal(cleanupRetryDelayMs(2), 60_000);
  assert.equal(cleanupRetryDelayMs(100), 6 * 60 * 60 * 1000);
});

test("a removed Google photo is not silently restored at next login", () => {
  assert.equal(
    shouldHydrateGoogleProfilePicture(
      true,
      undefined,
      "https://lh3.googleusercontent.com/photo",
    ),
    false,
  );
  assert.equal(
    shouldHydrateGoogleProfilePicture(
      false,
      undefined,
      "https://lh3.googleusercontent.com/photo",
    ),
    true,
  );
  assert.equal(
    shouldHydrateGoogleProfilePicture(
      false,
      "https://custom/photo",
      "https://lh3.googleusercontent.com/photo",
    ),
    false,
  );
});

test("a stale Google-hosted profile picture is refreshed without replacing custom photos", () => {
  assert.equal(
    shouldHydrateGoogleProfilePicture(
      false,
      "https://lh3.googleusercontent.com/old-photo",
      "https://lh3.googleusercontent.com/current-photo",
    ),
    true,
  );
  assert.equal(
    shouldHydrateGoogleProfilePicture(
      false,
      "https://lh3.googleusercontent.com/current-photo",
      "https://lh3.googleusercontent.com/current-photo",
    ),
    true,
  );
  assert.equal(
    shouldHydrateGoogleProfilePicture(
      false,
      "https://res.cloudinary.com/bondera/profile.jpg",
      "https://lh3.googleusercontent.com/current-photo",
    ),
    false,
  );
  assert.equal(
    shouldHydrateGoogleProfilePicture(
      false,
      "https://res.cloudinary.com/bondera/google-photo.jpg",
      "https://lh3.googleusercontent.com/current-photo",
      "google",
      "https://lh3.googleusercontent.com/current-photo",
    ),
    false,
  );
  assert.equal(
    shouldHydrateGoogleProfilePicture(
      false,
      "https://res.cloudinary.com/bondera/google-photo.jpg",
      "https://lh3.googleusercontent.com/new-photo",
      "google",
      "https://lh3.googleusercontent.com/current-photo",
    ),
    true,
  );
});

test("only HTTPS Google content hosts are accepted as verified profile sources", () => {
  assert.equal(
    isGoogleProfilePictureUrl("https://lh3.googleusercontent.com/photo"),
    true,
  );
  assert.equal(
    isGoogleProfilePictureUrl("http://lh3.googleusercontent.com/photo"),
    false,
  );
  assert.equal(
    isGoogleProfilePictureUrl("https://googleusercontent.com.evil.test/photo"),
    false,
  );
  assert.equal(isGoogleProfilePictureUrl("not-a-url"), false);
});
