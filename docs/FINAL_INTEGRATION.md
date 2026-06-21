# Final MVP Integration

This document records the Slice 13 integration checklist for the implemented
core MVP. Passing this checklist proves that the current product core works
together locally and with Telegram smoke credentials; it does not mean full
compliance with every requirement in `docs/PRODUCT_SPEC.md`.

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

Telegram services:

```bash
docker compose --profile telegram up bot worker
```

The `telegram` profile requires a real `TELEGRAM_BOT_TOKEN`, a public
`TELEGRAM_WEBAPP_URL`, and network access to Telegram APIs.

## Verification Checklist

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`
- `docker compose config`
- `docker compose up -d postgres redis`
- `pnpm db:generate`
- `pnpm db:migrate`
- API health check at `http://localhost:3001/health`
- Webapp opens at `http://localhost:3000`

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

## Telegram Smoke Checklist

Requires real Telegram credentials:

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

- `pnpm test:e2e` is not configured yet.
- DB-backed integration tests for API user isolation still require a dedicated
  PostgreSQL test harness.
- Telegram end-to-end checks require external credentials and a public HTTPS URL.
- `CATEGORY_CHECK`, `GROUP_CHECK`, and `SHOPPING_REMINDER` reminder delivery are
  not implemented yet.
- Telegram bot commands `/shopping`, `/check`, and `/settings` are not
  implemented yet.
- UI/API flows for configuring item/category/group check cycles and reminder
  toggles are incomplete.
- Unfinished check sessions are not persisted/discovered in the webapp after
  reload.
- Rate limiting for auth and other sensitive endpoints is still follow-up work.
- Category/item delete and reorder flows are not fully implemented where the
  product spec requires them; current flows prefer archiving.
- Recommendation action `Скрыть похожие` is not implemented yet.
- Browser/PWA sign-in without Telegram is not implemented yet. The preferred
  follow-up is passwordless email magic links with Telegram account linking.

## Previous Local Verification

Previous Slice 13 local verification recorded during implementation:

- `pnpm typecheck` passed.
- `pnpm lint` passed.
- `pnpm test` passed.
- `pnpm build` passed.
- `pnpm test:e2e` could not run because the script is not configured.
- Docker Compose smoke could not run in the current environment because the
  `docker` CLI is unavailable.

Before any release-readiness decision, rerun the checklist above in the current
workspace and record the fresh results. This section is historical context, not
a guarantee that the current working tree is clean.
