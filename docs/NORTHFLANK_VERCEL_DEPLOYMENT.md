# Northflank + Vercel Deployment

This document describes the current free-friendly staging topology for the
web-first MVP:

```text
Vercel:
  kupitnezabyt-webapp

Northflank:
  kupitnezabyt-api       service
  kupitnezabyt-postgres  PostgreSQL addon
```

Telegram bot and reminder worker remain optional integrations. Do not create
them on the Northflank Sandbox plan unless the team accepts either extra paid
services or a later architecture change that folds Telegram delivery into the
API/cron surface.

## Why This Topology

As of 2026-07-03, Northflank Sandbox is a good fit for the required MVP backend:

- 2 free services;
- 1 free database/addon;
- 2 free cron jobs;
- always-on compute without sleeping.

Northflank can still require a payment method before creating free Sandbox
resources. The product UI says the card is used to verify legitimate users and
that usage is not charged while on the Developer Sandbox.

The required MVP only needs the API and PostgreSQL on Northflank. Keeping the
webapp on Vercel preserves one Northflank service slot and avoids moving a
working static/Next.js deployment for no product benefit.

## Required Northflank Setup

Create a project:

```text
kupitnezabyt
```

Create a PostgreSQL addon:

```text
kupitnezabyt-postgres
```

Use the smallest free/Sandbox PostgreSQL option unless production data size or
traffic requires otherwise.

If Northflank opens an `Add a payment method` modal before creating the addon,
the account owner must add the card manually. Do not enter payment details
through automation.

Create an API service:

```text
kupitnezabyt-api
```

Connect it to the GitHub repository:

```text
kinkpunk/kupitnezabyt
```

If the GitHub integration is not connected in Northflank yet, connect it before
creating the service. Limit repository access to this repository if Northflank
offers that option.

## API Service

Use Node 22 compatible build/runtime settings.

Build type:

```text
Dockerfile
```

Use the repository root as the build context and `/Dockerfile` as the Dockerfile
location. The Dockerfile builds only the API runtime even though the repository
contains the webapp, bot, and worker packages.

Port:

```text
3001
```

Health check path:

```text
/health
```

Detailed manual health check:

```text
/health/detailed
```

`/health/detailed` verifies PostgreSQL connectivity and returns `503` when the
API cannot reach the database. Keep the platform health check on `/health`; use
the detailed endpoint during smoke testing and debugging.

Environment variables:

```env
NODE_ENV=production
DEV_AUTH_ENABLED=false
DATABASE_URL=<northflank-postgres-connection-url>
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
GOOGLE_REDIRECT_URI=https://<northflank-api-host>/api/auth/google/callback

# Optional Apple sign-in:
APPLE_CLIENT_ID=
APPLE_TEAM_ID=
APPLE_KEY_ID=
APPLE_PRIVATE_KEY=
APPLE_REDIRECT_URI=https://<northflank-api-host>/api/auth/apple/callback

# Optional Telegram integration only:
TELEGRAM_BOT_TOKEN=
```

The API fails fast in production when `JWT_SECRET`, `EMAIL_FROM`,
`EMAIL_PROVIDER_API_KEY`, or an HTTPS `APP_BASE_URL` are missing. This is
intentional: a deployment that cannot authenticate browser users should not
start successfully.

## Database Migrations

After creating the Northflank PostgreSQL addon and before product smoke testing,
run production migrations against the Northflank database:

```bash
DATABASE_URL=<northflank-postgres-connection-url> corepack pnpm db:deploy
```

Do not use `prisma migrate dev` in staging or production.

Optional staging seed:

```bash
DATABASE_URL=<northflank-postgres-connection-url> corepack pnpm db:seed
```

## Data Migration From Neon

Only run this after deciding on a maintenance window. The current app has no
read-only maintenance mode, so writes made to the old Render/Neon deployment
after the dump starts can be missed.

Recommended cutover sequence:

1. Confirm the Northflank PostgreSQL addon is empty or disposable.
2. Pause user traffic to the old API as much as practical.
3. Export from Neon using a direct database URL when possible.
4. Restore into the Northflank PostgreSQL addon.
5. Run `corepack pnpm db:deploy` against Northflank.
6. Start/restart the Northflank API.
7. Update Vercel `NEXT_PUBLIC_API_BASE_URL` to the Northflank API URL.
8. Redeploy the Vercel webapp.
9. Run automated deployment smoke and manual auth/product smoke.
10. Keep Render and Neon available until smoke passes and data looks correct.

Example local migration commands:

```bash
pg_dump --format=custom --no-owner --no-acl --file=/tmp/kupitnezabyt-neon.dump "$NEON_DATABASE_URL"
pg_restore --clean --if-exists --no-owner --no-acl --dbname="$NORTHFLANK_DATABASE_URL" /tmp/kupitnezabyt-neon.dump
DATABASE_URL="$NORTHFLANK_DATABASE_URL" corepack pnpm db:deploy
```

The `pg_restore --clean --if-exists` command deletes matching objects in the
target database before restoring them. Use it only for a new or intentionally
disposable Northflank database.

## Vercel Webapp

Keep the existing Vercel webapp deployment.

After the Northflank API URL is known, set:

```env
NEXT_PUBLIC_API_BASE_URL=https://<northflank-api-host>
```

Redeploy the webapp after changing `NEXT_PUBLIC_API_BASE_URL`, because this
value is embedded at build time.

## OAuth Provider Updates

For Google sign-in, add the exact Northflank callback URL to the Google OAuth
client:

```text
https://<northflank-api-host>/api/auth/google/callback
```

Set the same value in `GOOGLE_REDIRECT_URI`.

For Apple sign-in, add the exact Northflank callback URL to the Services ID
return URLs:

```text
https://<northflank-api-host>/api/auth/apple/callback
```

Set the same value in `APPLE_REDIRECT_URI`.

Keep the old Render callback URLs until the Northflank smoke has passed and the
cutover is complete.

## Smoke Checklist

First run the automated deployment smoke from the repository root:

```bash
DEPLOYED_API_BASE_URL=https://<northflank-api-host> \
DEPLOYED_WEBAPP_URL=https://<vercel-webapp-host> \
corepack pnpm smoke:deployment
```

The command verifies:

1. API `GET /health` returns `200`.
2. API `GET /health/detailed` returns `200` with `"db": true`.
3. Webapp opens by direct HTTPS URL and serves HTML.

Then complete the manual auth/product smoke:

1. Email magic link request sends a test email, or Google sign-in opens the
   configured provider consent flow.
2. Magic link verify or OAuth callback creates an authenticated browser session.
3. `GET /api/me` succeeds with the bearer token stored by the webapp.
4. Complete or skip onboarding.
5. Create a category.
6. Add an item.
7. Configure a check cycle and confirm due/upcoming checks appear as in-app
   reminders.
8. Set item status to `NEED_BUY`.
9. Confirm the item appears in the shopping list.
10. Mark the item bought and confirm it returns to `IN_STOCK`.
11. Export JSON from settings.

## Optional Telegram Integration

Do not deploy `apps/bot` and `apps/worker` as separate Northflank services on
the Sandbox plan by default. Together with the API they exceed the free service
budget.

If Telegram delivery is intentionally enabled later, choose one of these paths:

- accept paid Northflank services for bot and worker;
- convert reminder processing into a Northflank cron job if polling-only
  delivery is enough;
- move Telegram webhook handling into the API and keep the reminder worker as a
  cron job.

Any Telegram path must keep `TELEGRAM_BOT_TOKEN` secret and must not log tokens,
Telegram `initData`, JWTs, or sensitive user notes.

## Rollback

Keep the old Render API and Neon database until Northflank smoke passes.

Rollback path:

1. Set Vercel `NEXT_PUBLIC_API_BASE_URL` back to the Render API URL.
2. Redeploy the Vercel webapp.
3. Confirm `corepack pnpm smoke:deployment` passes against Render/Neon.
4. Only delete old Render/Neon resources after the Northflank deployment has
   been stable long enough for the team to be comfortable.
