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

Create a Neon PostgreSQL project and copy the pooled or direct connection string
into Render environment variables as `DATABASE_URL`.

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

Environment variables:

```env
NODE_ENV=production
DEV_AUTH_ENABLED=false
DATABASE_URL=
JWT_SECRET=
APP_BASE_URL=https://<vercel-webapp-host>
API_PORT=3001
LOG_LEVEL=info
EMAIL_FROM=
EMAIL_PROVIDER_API_KEY=
MAGIC_LINK_TOKEN_TTL_MINUTES=15
# Optional Telegram integration only:
TELEGRAM_BOT_TOKEN=
```

After the API URL is known, set the Vercel webapp variable
`NEXT_PUBLIC_API_BASE_URL` to that URL.

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

## Optional Telegram Setup

In BotFather:

1. Create or reuse the Telegram bot.
2. Set the Mini App/Web App URL to the Vercel webapp URL.
3. Keep the same `TELEGRAM_BOT_TOKEN` in API, bot, and worker services.

For first staging smoke, use `/start` or `/app`; the bot sends an inline button
that opens `TELEGRAM_WEBAPP_URL`.

## Smoke Checklist

1. API `GET /health` returns `200`.
2. Migration job completes successfully.
3. Webapp opens by direct HTTPS URL.
4. Email magic link request sends a test email.
5. Magic link verify creates an authenticated session.
6. Create a category.
7. Add an item.
8. Set item status to `NEED_BUY`.
9. Confirm the item appears in the shopping list.
10. Mark the item bought and confirm it returns to `IN_STOCK`.
11. Confirm due/upcoming checks appear as in-app reminders.

## Known Deployment Limitations

- `DEV_AUTH_ENABLED` must remain `false` outside local development.
- Webapp public env vars are build-time values.
- Email magic link auth is the release target and must be implemented before
  production browser smoke can pass.
- The optional bot implements `/start`, `/app`, and `/help`.
- The optional worker handles `ITEM_CHECK` Telegram reminders only.
