# Bondera birthday scheduler

This Cloudflare Worker replaces the paid Render Cron service. Its scheduled
handler sends one authenticated POST request to the existing backend birthday
endpoint every minute.

Required Worker bindings:

- `BACKEND_BASE_URL`: a plaintext variable containing the Render web-service
  origin, for example `https://YOUR-RENDER-SERVICE.onrender.com`.
- `BIRTHDAY_JOB_SECRET`: an encrypted secret containing exactly the same value
  as the Render web service's `BIRTHDAY_JOB_SECRET` environment variable.

The cron expression is `* * * * *`. Cloudflare evaluates cron expressions in
UTC, but the backend checks each user's saved timezone and remains responsible
for determining whose birthday is due.

The public `/health` route only reports Worker availability. It does not expose
a public way to run the birthday job.
