const apiBaseUrl = process.env.API_BASE_URL?.replace(/\/$/, "");
const secret = process.env.BIRTHDAY_JOB_SECRET;

if (!apiBaseUrl || !secret) {
  throw new Error("API_BASE_URL and BIRTHDAY_JOB_SECRET are required.");
}

void fetch(`${apiBaseUrl}/api/jobs/birthdays`, {
  method: "POST",
  headers: { "x-bondera-job-secret": secret }
}).then(async (response) => {
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`Birthday job failed (${response.status}): ${body}`);
  }
  process.stdout.write(`${body}\n`);
}).catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
