import assert from "node:assert/strict";
import test from "node:test";

import worker, {
  birthdayJobUrl,
  runBirthdayJob,
} from "../src/index.js";

const env = {
  BACKEND_BASE_URL: "https://bondera-backend.onrender.com/",
  BIRTHDAY_JOB_SECRET: "test-birthday-secret",
};

test("birthday endpoint is built from the Render base URL", () => {
  assert.equal(
    birthdayJobUrl(env.BACKEND_BASE_URL),
    "https://bondera-backend.onrender.com/api/jobs/birthdays",
  );
  assert.throws(
    () => birthdayJobUrl("http://bondera-backend.onrender.com"),
    /must use HTTPS/,
  );
});

test("scheduled request uses POST and the protected job header", async () => {
  let captured;
  const result = await runBirthdayJob(env, async (url, init) => {
    captured = { url, init };
    return new Response('{"success":true}', {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  });

  assert.equal(captured.url, birthdayJobUrl(env.BACKEND_BASE_URL));
  assert.equal(captured.init.method, "POST");
  assert.equal(
    captured.init.headers["x-bondera-job-secret"],
    env.BIRTHDAY_JOB_SECRET,
  );
  assert.equal(result.status, 200);
});

test("non-success backend responses fail the scheduled invocation", async () => {
  await assert.rejects(
    runBirthdayJob(
      env,
      async () => new Response("temporarily unavailable", { status: 503 }),
    ),
    /HTTP 503/,
  );
});

test("scheduled handler keeps the backend request alive", async () => {
  let scheduledPromise;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response('{"success":true}', { status: 200 });

  try {
    worker.scheduled({}, env, {
      waitUntil(promise) {
        scheduledPromise = promise;
      },
    });
    assert.ok(scheduledPromise instanceof Promise);
    await scheduledPromise;
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("public Worker URL exposes health only, never the birthday trigger", async () => {
  const health = await worker.fetch(
    new Request("https://fragrant-term-8117.example.workers.dev/health"),
  );
  const root = await worker.fetch(
    new Request("https://fragrant-term-8117.example.workers.dev/"),
  );

  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), {
    status: "ok",
    service: "bondera-birthday-scheduler",
  });
  assert.equal(root.status, 404);
});
