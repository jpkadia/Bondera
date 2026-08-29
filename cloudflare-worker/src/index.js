const BIRTHDAY_JOB_PATH = "/api/jobs/birthdays";

const requiredValue = (value, name) => {
  const normalized = typeof value === "string" ? value.trim() : "";

  if (!normalized) {
    throw new Error(`${name} is required.`);
  }

  return normalized;
};

export const birthdayJobUrl = (backendBaseUrl) => {
  const url = new URL(requiredValue(backendBaseUrl, "BACKEND_BASE_URL"));

  if (url.protocol !== "https:") {
    throw new Error("BACKEND_BASE_URL must use HTTPS.");
  }

  url.pathname = `${url.pathname.replace(/\/+$/, "")}${BIRTHDAY_JOB_PATH}`;
  url.search = "";
  url.hash = "";
  return url.toString();
};

export const runBirthdayJob = async (env, fetchImpl = fetch) => {
  const url = birthdayJobUrl(env.BACKEND_BASE_URL);
  const secret = requiredValue(
    env.BIRTHDAY_JOB_SECRET,
    "BIRTHDAY_JOB_SECRET",
  );
  const response = await fetchImpl(url, {
    method: "POST",
    headers: {
      accept: "application/json",
      "x-bondera-job-secret": secret,
    },
  });
  const responseBody = await response.text();

  if (!response.ok) {
    throw new Error(
      `Bondera birthday job returned HTTP ${response.status}: ${responseBody.slice(0, 300)}`,
    );
  }

  console.log(JSON.stringify({
    event: "bondera_birthday_job_completed",
    status: response.status,
    response: responseBody.slice(0, 500),
  }));

  return {
    status: response.status,
    responseBody,
  };
};

export default {
  scheduled(_controller, env, ctx) {
    ctx.waitUntil(runBirthdayJob(env));
  },

  async fetch(request) {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/health") {
      return Response.json({
        status: "ok",
        service: "bondera-birthday-scheduler",
      });
    }

    return new Response("Not found", { status: 404 });
  },
};
