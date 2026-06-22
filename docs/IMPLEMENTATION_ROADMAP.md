# Implementation Roadmap for `kupitnezabyt`

This roadmap follows `README.md`, `AGENTS.md`, `docs/PRODUCT_SPEC.md`, and the
current implementation.

The project should move in vertical slices: each slice must preserve the rule
that the backend is the source of truth for identity, status transitions,
`nextCheckAt`, and shopping list synchronization.

## Roadmap Status

Core MVP slices are implemented enough to exercise the main product loop:
Telegram-compatible auth, categories, tracked items, status transitions,
shopping list sync, item reminders, check sessions, groups, recommendations,
search, export, and account deletion.

Product direction changed on 2026-06-21: the release target is now a
**web-first MVP** with email magic link authentication and in-app reminders.
Telegram Mini App, Telegram Bot, and external Telegram reminder delivery are
kept as optional integration/future work because always-on Render background
workers are not free in the current deployment setup.

This does not mean full compliance with `docs/PRODUCT_SPEC.md`. The product spec
remains the source of the complete target. Existing Telegram slices are
historical implemented work, but the next release-readiness path is browser
auth, browser smoke, and in-app reminders.

Remaining web-first MVP gaps:

- Production deployment smoke for email magic link auth with a real email
  provider and HTTPS browser URL.
- Continued browser smoke for the production-safe bearer/JWT session flow.
- In-app reminder actions beyond opening the related item/category/group, such
  as direct status changes, starting checks, and snoozing from the reminder row.
- Continuing an unfinished check session after webapp reload or returning later.
- Rate limiting for auth and other sensitive endpoints.
- Explicit delete/reorder contracts for categories/items where the spec requires
  them; current MVP primarily uses archive flows.
- Recommendation action `Скрыть похожие`.
- `test:e2e` plus DB-backed API integration tests.
- Optional Telegram integration smoke if/when bot/worker deployment is enabled.

## Web-First Release Plan

### Slice 14: Email Magic Link Auth

Status: implemented in `0187e8e`.

Goal: let a production browser user sign in without Telegram.

Database:

- Add `User.email`, `User.emailVerifiedAt`, and optional `displayName`.
- Keep `telegramUserId` optional or nullable for future account linking.
- Add `MagicLinkToken` with hashed token, email, expiry, consumed timestamp, and
  indexes for lookup/cleanup.

Backend:

- Add `POST /api/auth/email/request`.
- Add `POST /api/auth/email/verify`.
- Hash raw magic link tokens before storing.
- Consume tokens exactly once.
- Enforce short TTL and generic responses to avoid email enumeration.
- Add rate limiting for auth endpoints.
- Return the existing bearer token/session shape after verification.

Webapp:

- Replace production Telegram-only auth with email entry and magic link verify
  screen.
- Keep dev auth only for `NODE_ENV=development`.
- Preserve optional Telegram auth path behind runtime detection/feature flag.

Tests:

- Unit tests for token hashing, expiry, one-time consumption, and generic
  request responses.
- API tests for request/verify success, expired token, consumed token, invalid
  token, and user isolation.

Implemented notes:

- Added nullable email/user fields and `MagicLinkToken`.
- Added request/verify endpoints with hashed one-time tokens, TTL, generic
  request response, and auth rate limiting.
- Added email provider integration with a development fallback link.
- Webapp supports email entry, magic link verification, existing bearer session
  storage, development auth only in development, and optional Telegram auth when
  Telegram WebApp runtime is present.

### Slice 15: In-App Reminders And Check Settings

Status: implemented in `62a48e6`.

Goal: make reminders useful without a paid always-on worker.

Backend:

- Add endpoints or response fields for due/upcoming reminders scoped to the
  authenticated user.
- Reuse existing `nextCheckAt`, `usageCycleDays`, and `reminderEnabled`.
- Add update support for item/category/group check cycles and reminder toggles.
- Ensure reminder rows remain idempotent where they are still used.

Webapp:

- Show due and upcoming checks on Home.
- Add settings/controls for `usageCycleDays`, `nextCheckAt`, and
  `reminderEnabled`.
- Add an action from an in-app reminder to open the related item/category/group.
- Direct row actions for status changes, starting checks, and snoozing remain
  follow-up work.

Tests:

- Unit tests for due/upcoming reminder selection.
- E2E happy path remains planned because `test:e2e` is not configured yet.

Implemented notes:

- Added `GET /api/reminders/in-app` for authenticated due/upcoming
  item/category/group reminders.
- Expanded item/category/group PATCH flows to update `usageCycleDays`,
  `nextCheckAt`, and `reminderEnabled` without requiring name changes.
- Home now shows due/upcoming in-app reminders.
- Settings now includes cycle/toggle controls for categories, groups, and items.
- Reminder rows can open the related item/category/group. Direct actions such as
  status change, start check, and snooze from the reminder row remain follow-up
  work.

### Slice 16: Web Deployment Finalization

Status: in progress.

Goal: keep the first release on free-friendly infrastructure.

- Vercel webapp.
- Render free web API, accepting cold starts for MVP.
- Neon/Postgres database.
- No required Render background workers.
- Telegram bot/worker deployment documented as optional and not part of release
  acceptance.

Implementation notes:

- Production API startup now fails fast when required auth/email env vars are
  missing or `APP_BASE_URL` is not HTTPS.
- `GET /health/detailed` verifies database connectivity for deployment smoke.
- Deployment docs distinguish Neon pooled API connections from direct migration
  connections and use the implemented `corepack pnpm db:deploy` command.

## Slice 1 Baseline

Historical baseline implemented in Slice 1:

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

Known Slice 1 baseline constraints at that point:

- `packages/ui` is intentionally not created yet.
- Telegram bot, worker, reminders, groups, check sessions, recommendations,
  search, export, onboarding, deployment, and CI were not implemented yet.
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

Status: implemented for item reminder data and API scheduling, without category,
group, or shopping reminder delivery.

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

Status: implemented for `ITEM_CHECK` reminders only.

Goal: send reminder messages through Telegram with duplicate protection.

Worker:

- Create `apps/worker`. Done.
- Implement due reminder polling. Done for `ITEM_CHECK`.
- `CATEGORY_CHECK`, `GROUP_CHECK`, and `SHOPPING_REMINDER` remain follow-up work
  from `PRODUCT_SPEC`.
- Send jobs through BullMQ/Redis or direct worker flow, depending on the simplest
  maintainable path at the time. Done with direct DB polling; BullMQ remains
  unnecessary until queue complexity is justified.
- Retry temporary failures with bounded backoff. Done by rescheduling pending
  reminders and marking final failures as `FAILED`.
- Never roll back user data because Telegram sending failed. Done; delivery
  failures update only reminder state.

Bot:

- Add notification message rendering. Done in `packages/shared`.
- Add item reminder buttons:
  - `Есть`. Done.
  - `Мало`. Done.
  - `Купить`. Done.
  - `Срочно`. Done.
  - `Позже`. Done.
  - `Открыть`. Done.
- Callback actions must call the same backend status logic used by the webapp.
  Done by moving item status workflows into `packages/database` and using them
  from both API and bot callbacks.
- Category/group reminder callbacks remain follow-up work.

Tests:

- Worker duplicate-prevention tests. Covered at unit level for sent/retry/failed
  paths; DB-level duplicate prevention still needs PostgreSQL integration tests.
- Bot callback idempotency tests. Callback parsing is covered in shared tests;
  database callback execution still needs integration tests.

## Slice 7: Check Sessions

Status: implemented for category check sessions.

Goal: support guided inventory checks.

Database:

- Add `CheckSession`. Done.
- Add `CheckSessionItem`. Done.

Backend:

- Implement category check session endpoints:
  - start. Done.
  - get. Done.
  - update item status. Done.
  - complete. Done.
  - cancel. Done.
- Snapshot active non-archived, non-`PAUSED` items at session start. Done.
- Reuse existing item status transition logic. Done.

Webapp:

- Add check screen with one item card, progress, and four status actions. Done.
- Add category entry point: `Проверить категорию`. Done.

Tests:

- Integration tests for session snapshot behavior and completion.
- E2E test for checking one category.
  These still require PostgreSQL and Playwright setup.

## Slice 8: Groups

Status: implemented.

Goal: add user-defined sets of items.

Database:

- Add `ItemGroup`. Done.
- Add `ItemGroupItem`. Done.

Backend:

- Implement group CRUD. Done.
- Implement add/remove group items. Done.
- Implement group check sessions by reusing Slice 7 session logic. Done.

Webapp:

- Add groups list. Done.
- Add group detail and item management. Done.
- Add group check entry point. Done.

Tests:

- Unit and integration tests for group membership uniqueness.
- Check-session tests for group sessions.
  DB-backed tests still require PostgreSQL integration setup.

## Slice 9: Rule-Based Recommendations

Status: implemented.

Goal: add deterministic recommendations without LLM/ML.

Database or code:

- Store rules in code or seed data. Done in `packages/shared`.
- Add `RecommendationDismissal`. Done.

Shared:

- Add:
  - `normalizeName`. Done.
  - rule matching. Done.
  - duplicate suppression. Done.
  - dismissal suppression. Done.

Backend:

- Implement:
  - `GET /api/recommendations?itemId=...`. Done.
  - accept. Done.
  - dismiss. Done.

Webapp:

- Show up to five suggestions after relevant item creation/status changes. Done.
- Require explicit confirmation before adding anything. Done.

Tests:

- Unit tests for normalization and matching. Done.
- Integration tests for accept/dismiss behavior.
  Still requires PostgreSQL integration setup.

## Slice 10: Search, Export, and Account Deletion

Status: implemented.

Goal: complete user data management pieces from MVP.

Backend:

- Add item search by name, brand, category, notes. Done.
- Add `GET /api/export/json`. Done.
- Add `DELETE /api/me`. Done.
- Ensure account deletion removes or makes inaccessible all user data. Done via
  user deletion and cascade relations.

Webapp:

- Add search screen or search field where it best fits. Done as a search tab.
- Add settings screen with export and delete account. Done.

Tests:

- Integration tests for user isolation in search/export/delete.
- Export shape snapshot test if useful. Done at shared envelope level; DB-backed
  endpoint tests still require PostgreSQL integration setup.

## Slice 11: Onboarding and Product Polish

Status: implemented for the current local onboarding model.

Goal: make first-run UX match the product spec.

Webapp:

- Add four-step onboarding:
  - welcome. Done.
  - starter categories. Done.
  - first items. Done.
  - notification explanation. Done.
- Add home screen:
  - readiness index. Done.
  - upcoming checks. Done for item `nextCheckAt`.
  - urgent items. Done.
  - quick category access. Done.
- Add bottom navigation:
  - Главная. Done.
  - Категории. Done.
  - Покупки. Done.
  - Проверка. Done.
  - Настройки. Done.

Database:

- Add onboarding state only if needed. Not needed for MVP; webapp stores local
  completion state in `localStorage`.
- Persisted per-user onboarding state remains a possible follow-up if multiple
  users/devices need first-run state to be synchronized.

Tests:

- E2E first-run flow in dev auth mode.
  Still requires a `test:e2e` setup.

## Slice 12: Shared UI Package, If Needed

Status: evaluated; not created.

Goal: introduce `packages/ui` only when duplication justifies it.

Create `packages/ui` when the webapp has stable repeated components such as:

- Button
- Input
- StatusBadge
- BottomTabBar
- Modal
- ConfirmDialog

Do not introduce `packages/ui` only for theoretical reuse.

Decision for the current MVP state:

- `packages/ui` is not created in Slice 12.
- The UI is still a single Next.js webapp with local CSS and local component
  structure.
- There is no cross-application or multi-file component reuse that would justify
  an extra package, build target, and dependency surface.
- Revisit after Slice 13 only if final integration exposes stable repeated
  components shared across screens or apps.

## Slice 13: Final Telegram-Compatible Core Integration

Status: implemented as historical Telegram-compatible core verification.
External Telegram smoke requires real credentials, a public HTTPS Mini App URL,
and always-on bot/worker processes; it is no longer required for the
free-friendly web-first MVP.

Goal: verify the implemented core MVP as one product and make remaining
`PRODUCT_SPEC` gaps explicit.

Tasks:

- Run all services through Docker Compose. Done by adding `app` and `telegram`
  compose profiles.
- Run:
  - `pnpm typecheck`. Done.
  - `pnpm lint`. Done.
  - `pnpm test`. Done.
  - `pnpm test:e2e`. Not configured yet; documented as a known gap.
- Confirm Telegram Mini App opens from the bot. Documented in
  `docs/FINAL_INTEGRATION.md`; requires real Telegram credentials.
- Confirm Telegram init data validation in production-like mode. Covered by
  deterministic auth tests; end-to-end Telegram smoke requires real init data.
- Confirm reminders are idempotent. Covered by worker unit tests for
  sent/retry/failed paths; DB-backed smoke remains in final checklist.
- Confirm no duplicate shopping entries are created. Enforced by DB partial
  unique index and shared status workflow; DB-backed smoke remains in final
  checklist.
- Confirm sensitive values are not logged. API logger redacts authorization and
  raw Telegram init data; manual log review remains in final checklist.
- Update `README.md`, `docs/API.md`, and `docs/ARCHITECTURE.md` where behavior
  changed. Done for README and architecture; API behavior did not change.

Finalization work after Slice 13:

- Run the full local Docker smoke from `docs/FINAL_INTEGRATION.md` when Docker
  is available.
- Add and run `pnpm test:e2e` for the main dev-auth product flow.
- Add DB-backed integration tests for auth/user isolation, CRUD, shopping
  duplicate prevention, check sessions, groups, recommendations, search, export,
  and account deletion.
- Implement Slices 14-16 for web-first release readiness.
- Run Telegram smoke only if optional Telegram deployment is enabled.

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
7. Magic link tokens and Telegram `initData` are validated only on the backend.
8. Never log magic link tokens, Telegram tokens, init data, JWTs, or sensitive notes.
