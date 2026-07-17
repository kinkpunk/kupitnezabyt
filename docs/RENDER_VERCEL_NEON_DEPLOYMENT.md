# Render + Vercel + Neon Deployment

This document describes the free-friendly staging deployment for the web-first
MVP. Telegram bot and worker services are optional integrations, not required
for the first browser release.

## Target Topology

```text
Vercel:
  kupitnezabyt-webapp

Render:
  kupitnezabyt-api       web service

Neon:
  kupitnezabyt-postgres
```

No always-on Render background worker is required for the web-first MVP. In-app
reminders are shown by the webapp/API when the user opens the product. Optional
Telegram delivery can be deployed later if paid worker infrastructure is
accepted.

## Repository Preparation

Required production scripts:

- Root `db:deploy` runs Prisma production migrations.
- Root `smoke:deployment` checks the deployed API and webapp.
- `packages/database db:deploy` runs `prisma migrate deploy`.
- `apps/webapp start` runs `next start`.

For local development, keep using:

```bash
corepack pnpm db:migrate
```

For staging/production, use:

```bash
corepack pnpm db:deploy
```

## Neon

Create a Neon PostgreSQL project.

Use the pooled connection string for the Render API `DATABASE_URL` so Prisma
does not exhaust free-tier connection limits during normal web traffic. For
one-off migration jobs, use Neon's direct connection string if available.

Use a database name such as:

```text
kupitnezabyt
```

## Render Services

All Render services should connect to the GitHub repository:

```text
kinkpunk/kupitnezabyt
```

Use Node 22 compatible runtime.

### API Web Service

Suggested name:

```text
kupitnezabyt-api
```

Build command:

```bash
rm -rf node_modules && corepack pnpm install --frozen-lockfile --prod=false && corepack pnpm db:generate && corepack pnpm --filter @kupitnezabyt/shared build && corepack pnpm --filter @kupitnezabyt/database build && corepack pnpm --filter @kupitnezabyt/api build
```

The `rm -rf node_modules` prefix applies only to Render's ephemeral build
environment. It prevents Render from reusing a production-only dependency cache
that can make `prisma generate` fail with `prisma: not found`.

Start command:

```bash
corepack pnpm --filter @kupitnezabyt/api start
```

Health check path:

```text
/health
```

Detailed manual health check:

```text
/health/detailed
```

`/health/detailed` verifies database connectivity and returns `503` when the API
cannot reach Postgres. Keep Render's automatic health check on `/health`; use
the detailed endpoint during smoke testing and debugging.

Environment variables:

```env
NODE_ENV=production
DEV_AUTH_ENABLED=false
DATABASE_URL=<neon-pooled-connection-url>
JWT_SECRET=<strong-random-secret>
APP_BASE_URL=https://<vercel-webapp-host>
API_PORT=3001
LOG_LEVEL=info
EMAIL_FROM=noreply@<verified-email-domain>
EMAIL_PROVIDER_API_KEY=<resend-api-key>
MAGIC_LINK_TOKEN_TTL_MINUTES=15
# Optional Google sign-in:
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=https://<render-api-host>/api/auth/google/callback
# Optional Apple sign-in:
APPLE_CLIENT_ID=
APPLE_TEAM_ID=
APPLE_KEY_ID=
APPLE_PRIVATE_KEY=
APPLE_REDIRECT_URI=https://<render-api-host>/api/auth/apple/callback
# Optional Telegram integration only:
TELEGRAM_BOT_TOKEN=
```

The API fails fast in production when `JWT_SECRET`, `EMAIL_FROM`,
`EMAIL_PROVIDER_API_KEY`, or an HTTPS `APP_BASE_URL` are missing. This is
intentional: a deployment that cannot authenticate browser users should not
start successfully.

After the API URL is known, set the Vercel webapp variable
`NEXT_PUBLIC_API_BASE_URL` to that URL.

For Google sign-in, create a Google OAuth Client with application type
`Web application` and add the exact authorized redirect URI used in
`GOOGLE_REDIRECT_URI`, for example:

```text
https://kupitnezabyt-api.onrender.com/api/auth/google/callback
```

The Google Auth Platform setup used for the production MVP is:

- Audience: `External`.
- Publishing status during MVP testing: `Testing`.
- Test users: add each Google account that should be allowed to sign in.
- OAuth client type: `Web application`.
- Authorized JavaScript origin: `https://kupitnezabyt-api.onrender.com`.
- Authorized redirect URI:
  `https://kupitnezabyt-api.onrender.com/api/auth/google/callback`.
- Render API env vars: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and
  `GOOGLE_REDIRECT_URI`.

For Apple sign-in, configure Sign in with Apple in the Apple Developer account:

- Enable Sign in with Apple for the app identifier.
- Create or reuse a Services ID matching `APPLE_CLIENT_ID`.
- Add the exact return URL used in `APPLE_REDIRECT_URI`, for example:
  `https://kupitnezabyt-api.onrender.com/api/auth/apple/callback`.
- Create a Sign in with Apple private key and store its Key ID in
  `APPLE_KEY_ID`.
- Store the Team ID in `APPLE_TEAM_ID`.
- Store the `.p8` private key PEM in `APPLE_PRIVATE_KEY`. Render env vars can
  keep newlines escaped as `\n`; the API normalizes them at startup.

After changing any Render API env vars, wait for the automatic environment
update deploy or trigger `Manual Deploy` / `Restart service` so the running
process reads the new values.

### Optional Bot Background Worker

This service is not required for the free-friendly web-first MVP. Create it only
when Telegram integration is intentionally enabled.

Suggested name:

```text
kupitnezabyt-bot
```

Build command:

```bash
corepack enable && corepack pnpm install --frozen-lockfile && corepack pnpm --filter @kupitnezabyt/shared build && corepack pnpm --filter @kupitnezabyt/database build && corepack pnpm --filter @kupitnezabyt/bot build
```

Start command:

```bash
corepack pnpm --filter @kupitnezabyt/bot start
```

Environment variables:

```env
NODE_ENV=production
DATABASE_URL=
TELEGRAM_BOT_TOKEN=
TELEGRAM_WEBAPP_URL=https://<vercel-webapp-host>
```

The bot currently uses Telegram polling, so no public webhook endpoint is
required.

### Optional Reminder Worker Background Worker

This service is not required for the free-friendly web-first MVP. Create it only
when external Telegram reminder delivery is intentionally enabled.

Suggested name:

```text
kupitnezabyt-worker
```

Build command:

```bash
corepack enable && corepack pnpm install --frozen-lockfile && corepack pnpm --filter @kupitnezabyt/shared build && corepack pnpm --filter @kupitnezabyt/database build && corepack pnpm --filter @kupitnezabyt/worker build
```

Start command:

```bash
corepack pnpm --filter @kupitnezabyt/worker start
```

Environment variables:

```env
NODE_ENV=production
DATABASE_URL=
TELEGRAM_BOT_TOKEN=
TELEGRAM_WEBAPP_URL=https://<vercel-webapp-host>
WORKER_POLL_INTERVAL_MS=300000
REMINDER_BATCH_SIZE=25
REMINDER_MAX_ATTEMPTS=5
```

The worker currently delivers `ITEM_CHECK` reminders only.

## Migration Job

Run after the Neon database is created and before product smoke testing:

```bash
rm -rf node_modules && corepack pnpm install --frozen-lockfile --prod=false && corepack pnpm db:generate && corepack pnpm db:deploy
```

The job must have `DATABASE_URL` set to the Neon PostgreSQL connection string.
Prefer the direct Neon connection string for this migration job. The API service
can keep using the pooled connection string.

Optional seed command for staging data:

```bash
corepack pnpm db:seed
```

Do not use `prisma migrate dev` in staging or production.

## Vercel Webapp

Create a Vercel project from the same GitHub repository.

Recommended settings:

```text
Framework preset: Next.js
Root directory: apps/webapp
Install command: corepack enable && corepack pnpm install --frozen-lockfile
Build command: corepack pnpm build
Output directory: .next
```

If Vercel does not resolve the workspace dependency `@kupitnezabyt/shared` with
that setup, use the repository root as the root directory instead:

```text
Root directory: .
Install command: corepack enable && corepack pnpm install --frozen-lockfile
Build command: corepack pnpm --filter @kupitnezabyt/webapp build
Output directory: apps/webapp/.next
```

Environment variables:

```env
NEXT_PUBLIC_API_BASE_URL=https://<render-api-host>
```

After changing `NEXT_PUBLIC_API_BASE_URL`, redeploy the webapp because this value
is embedded at build time.

The webapp build fails fast when `NEXT_PUBLIC_API_BASE_URL` is missing or points
to a local address in a Vercel build (see `apps/webapp/next.config.ts`), so a
misconfigured deployment cannot ship silently. If a Vercel deploy fails with
this error, add the variable for the affected environment and redeploy.

## Optional Telegram Setup

In BotFather:

1. Create or reuse the Telegram bot.
2. Set the Mini App/Web App URL to the Vercel webapp URL.
3. Keep the same `TELEGRAM_BOT_TOKEN` in API, bot, and worker services.

For first staging smoke, use `/start` or `/app`; the bot sends an inline button
that opens `TELEGRAM_WEBAPP_URL`.

## Smoke Checklist

First run the automated deployment smoke from the repository root:

```bash
DEPLOYED_API_BASE_URL=https://<render-api-host> \
DEPLOYED_WEBAPP_URL=https://<vercel-webapp-host> \
corepack pnpm smoke:deployment
```

The command verifies:

1. API `GET /health` returns `200`.
2. API `GET /health/detailed` returns `200` with `"db": true`.
3. Webapp opens by direct HTTPS URL and serves HTML.

Then complete the manual auth/product smoke:

1. Migration job completes successfully with `corepack pnpm db:deploy`.
2. Email magic link request sends a test email, or Google sign-in opens the
   configured provider consent flow.
3. Magic link verify or OAuth callback creates an authenticated browser session.
4. `GET /api/me` succeeds with the bearer token stored by the webapp.
5. Complete or skip onboarding.
6. Create a category.
7. Add an item.
8. Configure a check cycle and confirm due/upcoming checks appear as in-app
    reminders.
9. Set item status to `NEED_BUY`.
10. Confirm the item appears in the shopping list.
11. Mark the item bought and confirm it returns to `IN_STOCK`.
12. Export JSON from settings.

## Known Deployment Limitations

- `DEV_AUTH_ENABLED` must remain `false` outside local development.
- Webapp public env vars are build-time values.
- Render Free web services can cold start after inactivity. The first request
  after idle can be noticeably slower; this is accepted for the MVP.
- The webapp uses bearer tokens in `Authorization`, not cross-origin cookies.
  CORS must still allow the exact Vercel `APP_BASE_URL`.
- The optional bot implements `/start`, `/app`, and `/help`.
- The optional worker handles `ITEM_CHECK` Telegram reminders only.
