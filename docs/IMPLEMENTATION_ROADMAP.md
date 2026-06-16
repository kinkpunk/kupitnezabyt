# Implementation Roadmap for `kupitnezabyt`

This roadmap follows `README.md`, `AGENTS.md`, `docs/PRODUCT_SPEC.md`, and the
current Slice 1 implementation.

The project should move in vertical slices: each slice must preserve the rule
that the backend is the source of truth for identity, status transitions,
`nextCheckAt`, and shopping list synchronization.

## Current Baseline

Implemented in Slice 1:

- `pnpm` workspace with `apps/*` and `packages/*`.
- TypeScript base config and ESLint.
- `docker-compose.yml` with PostgreSQL and Redis.
- `packages/database` with Prisma models for:
  - `User`
  - `Category`
  - `Item`
  - `ShoppingListItem`
- `packages/shared` with pure status business logic:
  - `calculateNextCheckAt`
  - `getShoppingSyncAction`
  - status type guard
- `apps/api` with Fastify:
  - `GET /health`
  - `POST /api/auth/dev`
  - `POST /api/auth/telegram`
  - `GET /api/me`
  - category create/list/detail/update
  - item create/list/status change
  - shopping list list/complete
- `apps/webapp` with a simple mobile flow:
  - create category
  - add item
  - change item status
  - see `NEED_BUY`/`URGENT` items in shopping list
  - mark shopping entry bought
- Minimal `docs/API.md` and `docs/ARCHITECTURE.md`.

Known baseline constraints:

- `packages/ui` is intentionally not created yet.
- Telegram bot, worker, reminders, groups, check sessions, recommendations,
  search, export, onboarding, deployment, and CI are not implemented yet.
- Dev auth is available only when `NODE_ENV=development` and
  `DEV_AUTH_ENABLED=true`.
- Local full smoke testing requires Docker/PostgreSQL.

## Slice 1: First Vertical Product Flow

Status: implemented.

Goal:

```text
Open Telegram Mini App compatible webapp
-> create category
-> add item
-> change item status
-> automatically see item in shopping list
-> mark item bought
```

Important implementation decisions:

- Keep status transition logic in `packages/shared`.
- Apply status changes in `apps/api` inside Prisma transactions.
- Keep user isolation in the API auth context.
- Do not trust `userId` from request body or query parameters.
- Use a PostgreSQL partial unique index to prevent duplicate open shopping list
  entries for one tracked item.

Follow-up hardening for Slice 1:

- Add API integration tests against a test PostgreSQL database.
- Add one Playwright e2e scenario for the completed vertical flow.
- Add `POST /api/items/:id/mark-bought` as a direct item-level alias if the UI
  later needs it; current flow completes via shopping list entry.
- Improve local startup docs after the first successful Docker smoke test.

## Slice 2: Slice 1 Hardening and Basic CRUD Completion

Status: partially implemented.

Goal: make the first flow reliable enough to build on.

Backend:

- Add item detail endpoint. Done.
- Add item update endpoint. Done.
- Add category archive endpoint. Done.
- Add item archive endpoint. Done.
- Add manual shopping list item create/update/delete only if required by UI.
- Add completed shopping list cleanup. Done.
- Add consistent API error shape. Started for implemented endpoints.
- Add validation at API boundaries using simple explicit validation first.

Shared:

- Add `aggregateCategoryStatus`. Done.
- Add `calculateReadiness`. Done.
- Add unit tests for aggregation and readiness. Done.

Database:

- Keep existing models.
- Add indexes only when required by implemented queries.
- Do not add reminders, groups, recommendations, or check-session tables in this
  slice.

Webapp:

- Add edit item form. Done for item names.
- Add archive affordances with confirmation where needed. Done for categories
  and items.
- Show category item counts and aggregate status. Done.
- Show empty/loading/error states more consistently.

Tests:

- API integration tests for auth, user isolation, category CRUD, item CRUD, and
  shopping list duplicate protection.
- Keep `pnpm typecheck`, `pnpm lint`, and `pnpm test` green. Done for the
  current Slice 2 changes.

## Slice 3: Telegram Mini App Auth and Bot Entry Point

Status: implemented for the planned minimal entry point.

Goal: make the app open correctly from Telegram while keeping the browser dev
fallback.

Backend:

- Harden Telegram `initData` validation. Done.
- Add auth integration tests with valid, expired, and invalid Telegram init data.
  Done as deterministic auth unit tests without a database.
- Ensure logs redact tokens, JWTs, and raw init data. Done for API request logs.
- Consider rate limiting auth endpoints if it can be done without broad
  architectural churn.

Bot:

- Create `apps/bot`. Done.
- Implement only:
  - `/start`. Done.
  - `/app`. Done.
  - `/help`. Done.
- Provide an inline button that opens the Mini App. Done.
- Do not implement reminders or callback status actions yet.

Webapp:

- Use Telegram WebApp APIs for:
  - `initData`. Done.
  - theme parameters. Done.
  - ready/expand lifecycle. Done.
- Keep dev-auth browser fallback. Done.

Tests:

- Bot command unit tests where practical.
- Auth validation tests are currently the main acceptance gate for this slice.

## Slice 4: Shopping List Completion

Status: implemented.

Goal: finish the shopping-list behavior from the MVP spec.

Backend:

- Implement manual shopping list positions without tracked `itemId`. Done.
- Implement `PATCH /api/shopping-list/:id`. Done for manual entries.
- Implement `DELETE /api/shopping-list/:id`. Done for manual entries.
- Implement `DELETE /api/shopping-list/completed`. Done.
- Keep tracked item completion transactional:
  - `Item.status = IN_STOCK`. Done.
  - `Item.lastBoughtAt = now`. Done.
  - `Item.lastCheckedAt = now`. Done.
  - `ShoppingListItem.isCompleted = true`. Done.
  - `Item.nextCheckAt = calculateNextCheckAt(...)`. Done.

Webapp:

- Group shopping list entries by category. Done.
- Show urgent entries first. Done through API ordering.
- Add manual entry creation. Done.
- Add clear completed action. Done.

Tests:

- Unit and integration coverage for manual entries and tracked item completion.
  Unit checks are covered by the existing domain tests; integration tests still
  need a test PostgreSQL setup.

## Slice 5: Periodic Checks and Reminder Data

Status: implemented for data and API scheduling, without worker delivery.

Goal: add check scheduling data without sending Telegram reminders yet.

Database:

- Add reminder-related fields already described in `PRODUCT_SPEC` if missing.
  Done for category scheduling fields; item scheduling fields already existed.
- Add `Reminder` model. Done.

Shared:

- Add due-reminder calculation. Done.
- Add idempotency helpers for reminder keys if using DB-level uniqueness. Done.

Backend:

- Implement item snooze endpoint. Done.
- Implement reminder CRUD or internal service functions needed by worker. Done
  for item check reminder upsert/cancel service functions.
- Keep all date storage in UTC. Done by storing JavaScript `Date` values in
  PostgreSQL `DateTime`.
- Interpret user-facing scheduling through `User.timezone`. Deferred until
  user-configurable reminder times exist; current snooze uses whole UTC day
  offsets.

Tests:

- Unit tests for due-reminder calculation. Done.
- Integration tests for duplicate prevention.
  Still requires a test PostgreSQL setup.

## Slice 6: Worker and Telegram Notifications

Goal: send reminder messages through Telegram with duplicate protection.

Worker:

- Create `apps/worker`.
- Implement due reminder polling.
- Send jobs through BullMQ/Redis or direct worker flow, depending on the simplest
  maintainable path at the time.
- Retry temporary failures with bounded backoff.
- Never roll back user data because Telegram sending failed.

Bot:

- Add notification message rendering.
- Add item reminder buttons:
  - `Есть`
  - `Мало`
  - `Купить`
  - `Срочно`
  - `Позже`
  - `Открыть`
- Callback actions must call the same backend status logic used by the webapp.

Tests:

- Worker duplicate-prevention tests.
- Bot callback idempotency tests.

## Slice 7: Check Sessions

Goal: support guided inventory checks.

Database:

- Add `CheckSession`.
- Add `CheckSessionItem`.

Backend:

- Implement category check session endpoints:
  - start
  - get
  - update item status
  - complete
  - cancel
- Snapshot active non-archived, non-`PAUSED` items at session start.
- Reuse existing item status transition logic.

Webapp:

- Add check screen with one item card, progress, and four status actions.
- Add category entry point: `Проверить категорию`.

Tests:

- Integration tests for session snapshot behavior and completion.
- E2E test for checking one category.

## Slice 8: Groups

Goal: add user-defined sets of items.

Database:

- Add `ItemGroup`.
- Add `ItemGroupItem`.

Backend:

- Implement group CRUD.
- Implement add/remove group items.
- Implement group check sessions by reusing Slice 7 session logic.

Webapp:

- Add groups list.
- Add group detail and item management.
- Add group check entry point.

Tests:

- Unit and integration tests for group membership uniqueness.
- Check-session tests for group sessions.

## Slice 9: Rule-Based Recommendations

Goal: add deterministic recommendations without LLM/ML.

Database or code:

- Store rules in code or seed data.
- Add `RecommendationDismissal`.

Shared:

- Add:
  - `normalizeName`
  - rule matching
  - duplicate suppression
  - dismissal suppression

Backend:

- Implement:
  - `GET /api/recommendations?itemId=...`
  - accept
  - dismiss

Webapp:

- Show up to five suggestions after relevant item creation/status changes.
- Require explicit confirmation before adding anything.

Tests:

- Unit tests for normalization and matching.
- Integration tests for accept/dismiss behavior.

## Slice 10: Search, Export, and Account Deletion

Goal: complete user data management pieces from MVP.

Backend:

- Add item search by name, brand, category, notes.
- Add `GET /api/export/json`.
- Add `DELETE /api/me`.
- Ensure account deletion removes or makes inaccessible all user data.

Webapp:

- Add search screen or search field where it best fits.
- Add settings screen with export and delete account.

Tests:

- Integration tests for user isolation in search/export/delete.
- Export shape snapshot test if useful.

## Slice 11: Onboarding and Product Polish

Goal: make first-run UX match the product spec.

Webapp:

- Add four-step onboarding:
  - welcome
  - starter categories
  - first items
  - notification explanation
- Add home screen:
  - readiness index
  - upcoming checks
  - urgent items
  - quick category access
- Add bottom navigation:
  - Главная
  - Категории
  - Покупки
  - Проверка
  - Настройки

Database:

- Add onboarding state only if needed.

Tests:

- E2E first-run flow in dev auth mode.

## Slice 12: Shared UI Package, If Needed

Goal: introduce `packages/ui` only when duplication justifies it.

Create `packages/ui` when the webapp has stable repeated components such as:

- Button
- Input
- StatusBadge
- BottomTabBar
- Modal
- ConfirmDialog

Do not introduce `packages/ui` only for theoretical reuse.

## Slice 13: Final MVP Integration

Goal: verify the complete MVP as one product.

Tasks:

- Run all services through Docker Compose.
- Run:
  - `pnpm typecheck`
  - `pnpm lint`
  - `pnpm test`
  - `pnpm test:e2e`
- Confirm Telegram Mini App opens from the bot.
- Confirm Telegram init data validation in production-like mode.
- Confirm reminders are idempotent.
- Confirm no duplicate shopping entries are created.
- Confirm sensitive values are not logged.
- Update `README.md`, `docs/API.md`, and `docs/ARCHITECTURE.md` where behavior
  changed.

## Dependency Policy

- Prefer simple explicit code before adding dependencies.
- Do not add production dependencies without explaining why.
- Add validation libraries, data-fetching libraries, UI libraries, or OpenAPI
  generation only when the implemented slice clearly benefits from them.
- Keep privacy requirements in mind for medicines, hygiene products, and notes.

## Architectural Reminders

1. Backend is the source of truth for status transitions, `nextCheckAt`, and
   shopping list sync.
2. Shared package contains pure business logic only.
3. Every query must be scoped by `userId` from auth context.
4. `userId` from body or query parameters is never trusted.
5. Mutations that affect tracked items and shopping list entries must be
   transactional.
6. Shopping list and reminders require idempotency.
7. Telegram `initData` is validated only on the backend.
8. Never log Telegram tokens, init data, JWTs, or sensitive notes.
