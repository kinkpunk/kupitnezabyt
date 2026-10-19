# Northflank + Vercel Deployment

This document describes the current free-friendly staging topology for the
core MVP:

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

> Note: as of the 2026-10-19 production cutover, the Northflank API connects
> to the existing Neon database directly instead of the PostgreSQL addon
> described below, and Google sign-in uses the temporary Render bridge. See
> "Production Cutover (2026-10-19)" and "Temporary Google Bridge via Render".

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

## Production Cutover (2026-10-19)

The production API moved from Render (`kupitnezabyt-api.onrender.com`,
us-west) to Northflank (`p01--kupitnezabyt-api--rrnqxgknbkm9.code.run`,
Netherlands). The database stayed on Neon (AWS eu-central-1, Frankfurt); no
data migration was performed — the Northflank API connects to Neon directly.
Vercel `NEXT_PUBLIC_API_BASE_URL` points to the Northflank URL.

Measured from the browser (HAR exports of real product usage, warm
connections):

| Endpoint | Render p50 | Northflank p50 |
|---|---|---|
| OPTIONS roundtrip (no DB) | ~210 ms | ~46 ms |
| GET /api/categories | ~1250 ms | ~122 ms |
| GET /api/items | ~1240 ms | ~123 ms |
| GET /api/shopping-list | ~1490 ms | ~148 ms |
| GET /api/recommendations | ~1680 ms | ~157 ms |
| POST /api/items/:id/status | ~2000 ms | ~210 ms |
| GET /api/workspaces | ~4200 ms | ~360 ms |

Root cause of the old latency: Render (US West) paid a transatlantic round
trip to Neon (Frankfurt) for every sequential database query. With the API
in Europe the same Neon database answers in ~15 ms per round trip. The
webapp issues one OAuth call plus five list refetches per status change, so
the per-query cost multiplied into 1–2 s perceived delays.

Remaining work:

1. Attach a custom domain to the Northflank API; `*.code.run` cannot be
   used for Google/Apple OAuth (see below).
2. Switch `GOOGLE_REDIRECT_URI` (and `APPLE_REDIRECT_URI`) to the custom
   domain and register it with the providers.
3. Consider the Neon pooled connection host (`-pooler`) in
   `DATABASE_URL` to remove rare ~600 ms cold-connection spikes.
4. Re-run `corepack pnpm smoke:deployment`, verify sign-in, then
   decommission Render.

Until then, Google sign-in runs through the temporary Render bridge below.

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

### `code.run` Domains Cannot Be OAuth Redirect URIs

Google rejects Northflank-generated `*.code.run` redirect URIs with
`Invalid Redirect: must use a domain that is a valid top private domain`:
`code.run` is a public suffix, and Google requires the redirect host to be a
registrable (private) domain. A custom domain attached to the Northflank
service is therefore mandatory for Google sign-in; the generated Sandbox
URL only works for API traffic.

### Temporary Google Bridge via Render

Until a custom domain is attached, the Google callback can stay on Render
while the rest of the API serves from Northflank. Both deployments must
share the Neon database and the same `JWT_SECRET`: OAuth state tokens are
stored in the database and JWTs are HMAC-signed with that secret
(`apps/api/src/auth.ts`), so tokens issued by either API validate on both.

1. Northflank `GOOGLE_REDIRECT_URI=https://kupitnezabyt-api.onrender.com/api/auth/google/callback`
   (the Render callback, already registered with Google).
2. Northflank `APP_BASE_URL=https://<vercel-webapp-host>` — required for CORS
   (the API allows only this origin) and for the post-login redirect.
3. Render keeps its own `GOOGLE_REDIRECT_URI` and `APP_BASE_URL` unchanged.
4. The webapp calls Northflank `POST /api/auth/google/start`; Google
   redirects the browser to the Render callback; Render consumes the state
   from the shared database, issues a JWT, and redirects to the webapp with
   `?oauth_token=`.

Bridge behavior, verified 2026-10-19:

- Existing sessions survive the cutover — the webapp stores the API-issued
  JWT, which validates on Northflank as long as `JWT_SECRET` matches.
- New Google logins work end-to-end. Render is on the free tier and sleeps,
  so an occasional login pays a ~5 s cold start on the callback; product
  traffic never touches Render.
- Keep Render running while the bridge is in use; an external `/health`
  ping every ~10 minutes keeps it warm if the cold start matters.

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

### Apple Sign-In Enablement Checklist

The application code is complete: `POST /api/auth/apple/start` and
`POST /api/auth/apple/callback` are implemented and tested, and the webapp
shows the "Войти через Apple" button only when `GET /api/auth/providers`
reports `apple: true`. Enabling the provider is an operational task:

1. Prerequisite: an Apple Developer Program membership (paid) with access to
   Certificates, Identifiers & Profiles.
2. In the Apple Developer account, enable the Sign in with Apple capability
   for the app identifier.
3. Create (or reuse) a Services ID, set it as `APPLE_CLIENT_ID`, and register
   the exact return URL `https://<northflank-api-host>/api/auth/apple/callback`
   on it.
4. Create a Sign in with Apple key, download the `.p8` file once, and store
   its Key ID as `APPLE_KEY_ID`.
5. Set `APPLE_TEAM_ID` (Apple Developer Team ID), `APPLE_PRIVATE_KEY` (the
   `.p8` PEM contents; multiline values are normalized by the API), and
   `APPLE_REDIRECT_URI` on the Northflank API service.
6. Redeploy/restart the API so the new env vars take effect.
7. Smoke: `GET /api/auth/providers` returns `"apple": true`; the webapp login
   screen shows "Войти через Apple"; completing the flow lands back in an
   authenticated session (`GET /api/me` succeeds).

Until step 7 passes, the login screen simply hides the Apple button, so
shipping these changes before the provider setup is safe.

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

### Telegram Integration Smoke

Run the automated smoke from the repository root when `TELEGRAM_BOT_TOKEN` is
configured:

```bash
DEPLOYED_API_BASE_URL=https://<northflank-api-host> \
TELEGRAM_BOT_TOKEN=<telegram-bot-token> \
corepack pnpm smoke:telegram
```

The command verifies:

1. `TELEGRAM_BOT_TOKEN` is present.
2. Telegram Bot API `getMe` succeeds for the configured token.
3. API `GET /health` returns `200`.
4. API `GET /health/detailed` returns `200` with `"db": true`.
5. `POST /api/auth/telegram` rejects invalid `initData` with `400` or `401`,
   confirming the endpoint is wired to the configured bot token.

If `TELEGRAM_BOT_TOKEN` is not set, the smoke exits successfully with a skip
message — the integration remains optional and does not break CI.

## Rollback

Keep the old Render API and Neon database until Northflank smoke passes.

Rollback path:

1. Set Vercel `NEXT_PUBLIC_API_BASE_URL` back to the Render API URL.
2. Redeploy the Vercel webapp.
3. Confirm `corepack pnpm smoke:deployment` passes against Render/Neon.
4. Only delete old Render/Neon resources after the Northflank deployment has
   been stable long enough for the team to be comfortable.
