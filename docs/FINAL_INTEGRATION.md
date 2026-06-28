# Final MVP Integration

This document records the integration checklist for the implemented core MVP
and the new web-first release path. Passing this checklist proves that the
current product core works together locally and can be prepared for browser
release; it does not mean full compliance with every requirement in
`docs/PRODUCT_SPEC.md`.

Remaining product-spec gaps are tracked in `docs/IMPLEMENTATION_ROADMAP.md`.

## Local Compose

Infrastructure:

```bash
docker compose up -d postgres redis
```

Webapp and API:

```bash
docker compose --profile app up webapp api
```

Optional Telegram services:

```bash
docker compose --profile telegram up bot worker
```

The `telegram` profile is not required for the web-first MVP. It requires a
real `TELEGRAM_BOT_TOKEN`, a public `TELEGRAM_WEBAPP_URL`, network access to
Telegram APIs, and an always-on process.

## Verification Checklist

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`
- `pnpm test:e2e`
- `pnpm test:integration`
- `docker compose config`
- `docker compose up -d postgres redis`
- `pnpm db:generate`
- `pnpm db:migrate`
- API health check at `http://localhost:3001/health`
- API detailed health check at `http://localhost:3001/health/detailed`
- Webapp opens at `http://localhost:3000`
- Deployed API/webapp smoke with `corepack pnpm smoke:deployment`

These checks should be treated as release-readiness checks for the implemented
core MVP, not as acceptance of the full product spec.

## Product Smoke Checklist

Use development auth only with:

```env
NODE_ENV=development
DEV_AUTH_ENABLED=true
```

Minimum browser smoke:

1. Open the webapp.
2. Complete or skip onboarding.
3. Create a category.
4. Add an item.
5. Change item status to `NEED_BUY`.
6. Confirm the item appears in shopping list.
7. Mark the shopping item bought.
8. Confirm the tracked item returns to `IN_STOCK`.
9. Create a group and start a group check.
10. Search for an item.
11. Export JSON from settings.

## Web-First Smoke Checklist

Target release smoke after email auth is implemented:

1. Open the deployed webapp HTTPS URL in a mobile browser.
2. Confirm deployed API `GET /health` and `GET /health/detailed` pass.
3. Request a magic link for a real test email.
4. Open the magic link and confirm authenticated session is created.
5. Confirm `GET /api/me` resolves the email-authenticated user.
6. Complete or skip onboarding.
7. Create a category.
8. Add an item with `usageCycleDays`.
9. Confirm the item's next check date follows the configured cycle.
10. Confirm the item appears in upcoming in-app reminders when due or near due,
   and that the in-app reminder notice is shown on app open.
11. Snooze or update the reminder and confirm no duplicate shopping/reminder
   entries are created.
12. Change item status to `NEED_BUY`.
13. Confirm the item appears in shopping list.
14. Mark the shopping item bought.
15. Confirm the tracked item returns to `IN_STOCK`.
16. Export JSON from settings.

## Optional Telegram Smoke Checklist

Requires real Telegram credentials and deployed bot/worker services:

1. Set `TELEGRAM_BOT_TOKEN`.
2. Set `TELEGRAM_WEBAPP_URL` to a public HTTPS URL serving the webapp.
3. Start `bot`, `api`, `webapp`, and `worker`.
4. Open the bot in Telegram.
5. Run `/start` or `/app`.
6. Confirm the inline button opens the Mini App.
7. Confirm production auth calls `POST /api/auth/telegram` with valid Telegram
   WebApp `initData`.
8. Trigger or seed a due `ITEM_CHECK` reminder.
9. Confirm the worker sends one Telegram message and marks the reminder `SENT`.
10. Re-run the worker poll and confirm the same reminder is not sent again.

## Known Gaps

- `pnpm test:e2e` now covers the primary dev-auth browser stock flow; broader
  coverage for groups, check sessions, search variants, and export can be
  expanded as the release suite matures.
- `pnpm test:integration` now provides a DB-backed API harness for user
  isolation and shopping-list sync; it requires a migrated PostgreSQL test
  database through `DATABASE_URL`.
- Telegram end-to-end checks are optional and require external credentials,
  deployed bot/worker services, and a public HTTPS URL.
- Item reorder is not implemented because current item ordering is creation-date
  based and the data model has no item `sortOrder` field.
- Telegram account linking can be added later as optional integration.

## Previous Local Verification

Previous Slice 13 local verification recorded during implementation:

- `pnpm typecheck` passed.
- `pnpm lint` passed.
- `pnpm test` passed.
- `pnpm build` passed.
- `pnpm test:e2e` was not configured at that time; it was added later in Slice
  26 and now requires a migrated PostgreSQL database.
- Docker Compose smoke could not run in the current environment because the
  `docker` CLI is unavailable.

Before any release-readiness decision, rerun the checklist above in the current
workspace and record the fresh results, including `pnpm test:e2e` and `pnpm
test:integration` in an environment with PostgreSQL available. This section is
historical context, not a guarantee that the current working tree is clean.

## Current Local Verification

Verification run on 2026-06-25 in the local Codex workspace:

- `pnpm typecheck` passed.
- `pnpm lint` passed.
- `pnpm test` passed: 18 test files passed, 1 DB-backed integration file
  skipped by default.
- `pnpm build` passed.
- `pnpm test:integration` could not complete because PostgreSQL was not
  reachable at `localhost:5432`.
- `pnpm test:e2e` started the dev webapp/API and failed its preflight because
  `GET /health/detailed` returned `503` with `db: false`.
- Docker Compose could not be used in this workspace because the `docker` CLI
  is unavailable.

Before release, rerun the DB-backed commands in an environment with a migrated
PostgreSQL database:

```bash
docker compose up -d postgres redis
pnpm db:generate
pnpm db:migrate
pnpm test:integration
pnpm test:e2e
```
