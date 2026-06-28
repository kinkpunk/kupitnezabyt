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

- Extended E2E/DB-backed coverage for secondary flows beyond the Slice 26 smoke
  and user-isolation harness.
- Item reorder if a later UX/data-model change adds item-level `sortOrder`.
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
- E2E coverage was not available when this slice was implemented; the basic
  browser harness was added later in Slice 26.

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

Status: implemented.

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
- Added `corepack pnpm smoke:deployment` for repeatable deployed API/webapp
  smoke checks against HTTPS URLs. It verifies `/health`, `/health/detailed`
  database connectivity, and that the webapp serves HTML.
- Production release smoke remains a per-deploy procedure because email delivery,
  OAuth provider settings, and Render/Vercel/Neon runtime state live outside the
  repository.

### Slice 17: OAuth Account Identity Foundation

Status: implemented as backend/data foundation.

Goal: prepare the auth model and API contracts so Google and Apple sign-in can
coexist with email magic links without duplicating users or weakening account
isolation.

Database:

- Add `AuthAccount` or equivalent provider account model with `userId`,
  `provider`, `providerAccountId`, `email`, `emailVerified`, and timestamps.
- Keep `User.email` as the primary contact email when a provider returns a
  verified email.
- Add uniqueness on `(provider, providerAccountId)`.
- Define a safe linking rule: if a verified provider email matches an existing
  `User.email`, attach the provider account to that user; otherwise create a
  new user.

Backend:

- Add provider-neutral OAuth state storage with hashed state, nonce, expiry, and
  one-time consumption.
- Add shared token/session issuing code so email magic link, Google, Apple, and
  optional Telegram all return the same bearer token shape.
- Reject unverified provider emails for automatic account linking.
- Keep magic link auth available as fallback while OAuth rolls out.

Webapp:

- Add provider-neutral auth UI slots on the login screen when a provider is
  configured in Slice 18 or Slice 19.
- Preserve magic link as a fallback action.
- Show provider errors without leaking provider tokens or raw callback payloads.

Tests:

- Unit tests for provider account linking rules.
- API tests for state expiry, state reuse, provider account creation, and
  existing-user linking.

Implemented notes:

- Added `AuthAccount` for stable provider identities and `OAuthStateToken` for
  hashed state/nonce storage.
- Added `AuthProvider` enum for Google and Apple.
- Added provider-neutral OAuth secret hashing, expiry, and usability helpers.
- Added safe account resolution/linking logic that only auto-links existing
  users by verified provider email.
- Magic link remains the visible production auth method until Slice 18/19 add
  real provider start/callback routes and UI buttons.

### Slice 18: Google Sign-In

Status: implemented and verified in production.

Goal: let browser users sign in with Google without waiting for an email magic
link.

Provider setup:

- Create a Google OAuth Client ID with application type `Web application`.
- Configure exact authorized redirect URI, for example
  `https://<api-host>/api/auth/google/callback`.
- Request only OpenID Connect identity scopes: `openid email profile`.

Backend:

- Add `POST /api/auth/google/start` to create state and return the Google
  authorization URL.
- Add `GET /api/auth/google/callback` to validate state, exchange the code,
  verify ID token issuer/audience/nonce/expiry, and resolve/create the user.
- Store only stable provider identifiers and non-sensitive profile metadata.
- Return to the webapp with the same session shape used by magic link auth.

Webapp:

- Add "Continue with Google" to the login screen.
- Handle OAuth callback result and store the bearer token.
- Keep email magic link visible as fallback.

Environment:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI`

Tests:

- Provider-token verification unit tests with mocked JWKS/token responses.
- Route tests for start/callback happy path, invalid state, reused state,
  provider email missing, and account linking.

Implemented notes:

- `POST /api/auth/google/start` stores hashed state/nonce and returns a Google
  authorization URL.
- `GET /api/auth/google/callback` consumes state once, exchanges the code,
  verifies the Google ID token signature and issuer/audience/nonce/expiry, then
  uses the Slice 17 linking foundation.
- The webapp login screen now offers "Войти через Google" while preserving email
  magic link fallback.
- Google sign-in is enabled in production with a Google OAuth web client,
  Render API env vars, and Google Auth Platform test users.
- Production smoke passed: a test user can complete Google sign-in from the
  deployed webapp and land back in the authenticated app session.

### Slice 19: Auth UX Polish

Status: implemented.

Goal: make the now-working production auth experience clearer, calmer, and more
recoverable before adding another OAuth provider.

Scope:

- Improve the login screen hierarchy around Google sign-in and email fallback.
- Add clearer loading states for Google redirect and magic link request.
- Show friendly error messages for common OAuth failures:
  `GOOGLE_AUTH_NOT_CONFIGURED`, denied consent, invalid state, expired state,
  and unavailable provider.
- Avoid exposing raw callback query values after auth errors.
- Make signed-in/out transitions feel instant and predictable on mobile.
- Keep email magic link available as a fallback during Google rollout.

Tests:

- Add focused frontend tests for OAuth callback token/error handling where the
  existing frontend test setup supports it.
- Keep backend route coverage for Google start/callback in place.

Implemented notes:

- Login screen now prioritizes Google sign-in, keeps email magic link as a
  clear fallback, and shows explicit loading states for provider redirect and
  magic link request.
- Magic link and OAuth callback returns show a dedicated "finishing sign-in"
  loading state while the browser session is stored.
- OAuth callback errors are mapped to friendly messages and raw callback query
  values are removed from the address bar.
- Removed the duplicated home quick-action buttons for categories, shopping,
  checks, search, and groups; primary navigation remains in the tab bar.
- Search is now global across the authenticated app: a persistent search field
  submits from any section and opens a single results view.

### Slice 20: Apple Sign-In

Status: implemented.

Goal: support Sign in with Apple as a second OAuth/OIDC provider after the
provider-neutral foundation and Google flow are stable.

Provider setup:

- Requires an Apple Developer account and Sign in with Apple capability.
- Configure Services ID, Team ID, Key ID, private key, and exact redirect URI,
  for example `https://<api-host>/api/auth/apple/callback`.
- Account for Apple private relay emails and the fact that name is usually
  returned only on the first authorization.

Backend:

- Add `POST /api/auth/apple/start` or `GET /api/auth/apple/start`.
- Add `POST /api/auth/apple/callback` or `GET /api/auth/apple/callback`
  depending on Apple response mode.
- Generate Apple client secret JWT server-side.
- Verify Apple ID token issuer/audience/nonce/expiry and resolve/create user via
  the provider-neutral auth account model.

Webapp:

- Add "Continue with Apple" using Apple-compliant button treatment.
- Keep Google and email magic link available.

Environment:

- `APPLE_CLIENT_ID`
- `APPLE_TEAM_ID`
- `APPLE_KEY_ID`
- `APPLE_PRIVATE_KEY`
- `APPLE_REDIRECT_URI`

Tests:

- Client secret generation tests.
- Callback tests for first-login profile fields, private relay email, invalid
  state, invalid token, and existing-user linking.

Implemented notes:

- Added `POST /api/auth/apple/start` and `POST /api/auth/apple/callback` using
  the existing hashed OAuth state/nonce storage.
- Added server-side Apple client secret JWT generation with ES256 and
  `.p8` private key support.
- Added Apple ID token verification against Apple JWKS, issuer, audience,
  nonce, expiry, and provider account subject.
- The webapp login screen now offers "Войти через Apple" while preserving
  Google and email magic link fallback.
- Apple auth errors are mapped to friendly webapp messages.
- Added Apple route tests and helper tests for configuration, authorization URL,
  client secret generation, and email verification claim handling.

### Slice 21: In-App Reminder Row Actions

Status: implemented.

Goal: let users act on due/upcoming reminders directly from Home without first
opening the related item, category, or group.

Backend:

- Add item reminder actions that reuse the existing item status transition
  workflow for `LOW`, `NEED_BUY`, `URGENT`, and `IN_STOCK`.
- Add category/group reminder actions for starting a check session.
- Add snooze support for item/category/group reminders by updating
  `nextCheckAt` without creating duplicate reminder rows or shopping entries.
- Keep all actions scoped to the authenticated user.

Webapp:

- Add compact row actions on in-app reminder rows:
  - item reminders: status change and snooze;
  - category/group reminders: start check and snooze.
- Refresh reminders, item/category/group state, and shopping list after each
  action.
- Keep the existing "Open" action as a secondary path.

Tests:

- Unit tests for snooze date calculation where shared logic is reused or added.
- API route tests for user isolation and idempotent shopping/reminder effects.

Implemented notes:

- Reminder rows now expose direct actions instead of only opening the related
  entity.
- Item reminder rows can set `IN_STOCK`, `LOW`, `NEED_BUY`, or `URGENT` through
  the existing item status endpoint.
- Item reminder rows can snooze through the existing item snooze endpoint.
- Category and group reminder rows can start a check session directly.
- Category and group reminder rows can snooze by updating `nextCheckAt` through
  the existing authenticated PATCH endpoints.
- Existing reminder row "Open" remains available as a secondary action.

### Slice 22: Check Session Resume

Status: implemented.

Goal: let users continue an unfinished check session after reload or returning
to the app later.

Backend:

- Add an endpoint for the latest active check session for the authenticated
  user, optionally filtered by category or group.
- Return enough session/item context for the existing check screen to resume.
- Keep session ownership and archived item behavior consistent with current
  check session endpoints.

Webapp:

- Discover an active check session on boot or when opening the Check tab.
- Show a resume affordance when an unfinished session exists.
- Persist no sensitive session data in localStorage; backend remains the source
  of truth.

Tests:

- API route tests for active-session discovery, no-session response, and user
  isolation.
- Focused frontend behavior coverage if the webapp test harness exists by then.

Implemented notes:

- Added `GET /api/check/session/active` to return the latest `IN_PROGRESS`
  check session for the authenticated user, or `null` when none exists.
- Webapp now discovers an active check session on boot and when opening the
  Check tab.
- The Home screen shows a "Continue" affordance for unfinished checks.
- Resumed sessions restore the related category or group selection and continue
  using the existing check screen/status actions.
- Added API route coverage for active-session discovery.

### Slice 23: Rate Limiting Hardening

Status: implemented.

Goal: make auth and sensitive endpoints safer in production without adding
unnecessary infrastructure.

Backend:

- Replace the current in-memory auth limiter with a small reusable limiter
  abstraction.
- Apply stricter limits to auth start/request endpoints:
  - email magic link request;
  - Google start;
  - Apple start;
  - optional Telegram auth.
- Add conservative limits to sensitive endpoints such as export and account
  deletion.
- Keep responses generic where endpoint behavior could reveal account existence.

Tests:

- Unit tests for limiter window/reset behavior.
- Route tests for `429` behavior and normal requests after reset.

Implemented notes:

- Replaced the inline auth rate-limit map with a reusable in-memory limiter.
- Applied auth limits to email magic-link requests, Google start, Apple start,
  and optional Telegram auth.
- Applied conservative per-user limits to account deletion and JSON export.
- Kept `429` responses generic and covered limiter reset behavior in unit and
  route tests.

### Slice 24: Delete And Reorder Contracts

Status: implemented.

Goal: align category/item management contracts with `PRODUCT_SPEC.md` while
preserving archive-first UX as the safer default.

Backend:

- Define explicit delete contracts for archived and active categories/items.
- Keep destructive active deletes behind clear API semantics and user ownership
  checks.
- Add reorder endpoints for categories and, if needed by the UX, item ordering.
- Preserve existing archive/restore behavior.

Webapp:

- Keep archive as the primary mobile action.
- Add delete/reorder UI only where it is clear, reversible when possible, and
  not visually noisy.

Tests:

- API route tests for non-empty category delete behavior, ownership isolation,
  reorder persistence, and archive compatibility.

Implemented notes:

- `DELETE /api/categories/:id` and `DELETE /api/items/:id` now distinguish
  active owned records from missing/cross-user records: active records return
  `409` and must be archived before deletion.
- Added `POST /api/categories/reorder` to persist active category `sortOrder`
  for the authenticated user.
- Preserved archive/restore as the primary safer workflow.
- Item reorder was intentionally left out because `Item` has no `sortOrder`
  field; current item ordering remains creation-date based until a UX/data-model
  change requires it.

### Slice 25: Recommendation Hide Similar

Status: implemented.

Goal: implement the `Скрыть похожие` recommendation action from the product
spec.

Shared/backend:

- Extend recommendation dismissal semantics so a user can hide a family/rule of
  similar suggestions, not only one suggested item.
- Keep recommendation generation rule-based and deterministic.
- Ensure hidden-similar records are scoped by `userId`.

Webapp:

- Add `Скрыть похожие` next to existing recommendation actions.
- Remove affected recommendations from the current view immediately after the
  backend confirms the action.

Tests:

- Unit tests for rule/family dismissal filtering.
- API route tests for accepting, dismissing one, and hiding similar.

Implemented notes:

- Added rule-family recommendation dismissal using the existing
  `RecommendationDismissal` table with a wildcard suggested item.
- Added `POST /api/recommendations/:id/hide-similar`.
- Webapp recommendations now expose `Скрыть похожие` and remove all current
  suggestions from the hidden rule after backend confirmation.
- Completing a category or group check now recalculates that entity's
  `nextCheckAt`, so the active reminder disappears until the next due window.
- Item reminder settings no longer render every item at once; Settings uses an
  item picker and shows only selected or already configured item reminders.

### Slice 26: E2E And DB-Backed Integration Tests

Status: implemented.

Goal: turn the current release smoke checklists into repeatable automated
coverage for the main web-first product loop.

Test infrastructure:

- Add `pnpm test:e2e` with a minimal Playwright setup for the webapp.
- Add a PostgreSQL-backed API integration test harness that can run against an
  isolated test database.
- Keep tests deterministic and avoid real email/OAuth/Telegram providers.

Coverage:

- Browser happy path with development auth:
  onboarding, category creation, item creation, status change, shopping list,
  bought flow, group/check flow, search, and JSON export.
- API integration coverage for user isolation and duplicate shopping list
  prevention.

Acceptance:

- `pnpm typecheck`, `pnpm lint`, `pnpm test`, and `pnpm test:e2e` are all
  documented and runnable in the intended local/CI environment.

Implemented notes:

- Added `@playwright/test`, `playwright.config.ts`, and `pnpm test:e2e`.
- Added a mobile Chromium browser smoke for the web-first dev-auth flow:
  onboarding, category creation, item creation, shopping completion, and global
  search.
- Added an API health preflight so E2E fails quickly when PostgreSQL is not
  reachable by the API.
- Added `apps/api/src/db-backed.integration.test.ts` and `pnpm
  test:integration` for real database coverage of user isolation and shopping
  list synchronization.
- Added `vitest.config.ts` so regular `pnpm test` excludes Playwright specs
  while still keeping the DB-backed integration file skipped unless explicitly
  enabled.
- Updated README and final integration docs with the new verification commands.
- Local verification in this implementation environment could not complete
  `pnpm test:e2e` or `pnpm test:integration` because PostgreSQL was not running
  at `localhost:5432`; both commands now report that requirement explicitly.

## Post-MVP Collaboration Plan

Shared lists and household/family collaboration are intentionally kept after
Slice 26. The current implementation scopes almost every product entity by
`userId`, which is good for MVP isolation but should not be stretched into
collaboration with ad hoc exceptions. Collaboration should introduce an
explicit shared space and membership model, then migrate access checks onto
that model.

### Slice 27: Shared Workspace Data Model

Status: implemented foundation.

Goal: introduce an explicit shared space for personal and collaborative stock
lists while preserving existing single-user behavior.

Database:

- Add a `Workspace` or `Household` model owned by a user.
- Add `WorkspaceMember` with user, workspace, role, invitation metadata, and
  timestamps.
- Create a personal workspace for every existing user.
- Add `workspaceId` to categories, items, shopping list rows, reminders, groups,
  check sessions, and recommendation dismissals.
- Backfill existing records into each user's personal workspace.

Backend:

- Resolve the active workspace from the authenticated user context and request.
- Keep `userId` as identity, not as the only authorization boundary.
- Preserve owner-only operations for destructive workspace changes.

Tests:

- Migration/backfill coverage where practical.
- API tests proving that users cannot access workspaces where they are not
  members.

Implemented notes:

- Added `Workspace`, `WorkspaceMember`, and `WorkspaceRole`.
- Added nullable `workspaceId` links to categories, items, shopping list rows,
  reminders, groups, check sessions, and recommendation dismissals.
- Added a migration that creates a personal workspace and owner membership for
  every existing user, then backfills existing records into that workspace.
- Added database helpers for deterministic personal workspace ids and
  idempotent personal workspace creation.
- Auth flows now ensure a personal workspace exists, and new product records
  created by current single-user APIs store the user's personal `workspaceId`.
- Full member-based API authorization remains intentionally deferred to Slice
  29, where product APIs move from owner-only `userId` filters to workspace
  membership checks.

### Slice 28: Email Invitations

Status: implemented backend.

Goal: let a user invite another verified email user into a shared workspace.

Backend:

- Add invite creation by email for workspace owners.
- Store hashed invitation tokens with expiry and accepted/revoked timestamps.
- Send invitation links through the existing email provider.
- Let signed-in users accept only invitations matching their verified email.

Webapp:

- Add a settings section for "Совместный доступ".
- Show pending invites, current members, roles, and revoke actions.

Tests:

- API tests for invite creation, acceptance, expiry, revocation, and email
  mismatch.

Implemented notes:

- Added `WorkspaceInvitation` with hashed token storage, expiry,
  accepted/revoked timestamps, inviter, invited email, role, and workspace
  relation.
- Added owner-only `POST /api/workspaces/:workspaceId/invitations` for inviting
  an existing verified email user.
- Added owner-only pending invitation/member listing and invitation revocation
  endpoints for the future settings UI.
- Added `POST /api/workspace-invitations/accept` for signed-in users to accept
  only invitations matching their own verified email.
- Added invitation email delivery through the existing email provider with a
  development fallback link.
- Webapp login bootstrap now accepts `workspace_invite_token` links after the
  user is authenticated and shows friendly invitation errors.
- Added API and auth-helper tests for invitation creation, listing, revocation,
  acceptance, owner checks, email mismatch, hashing, expiry, accepted and
  revoked states.
- Settings UI for pending invites/member management remains part of Slice 30,
  where collaboration UX is introduced alongside workspace switching.

### Slice 29: Shared Access API Contracts

Status: planned.

Goal: move product APIs from direct owner-only `userId` filters to workspace
membership authorization.

Backend:

- Add shared helpers for workspace authorization and role checks.
- Update category, item, shopping list, reminder, group, check session, search,
  recommendation, export, and account deletion flows.
- Keep status transitions and shopping synchronization centralized and
  workspace-safe.
- Decide whether recommendation dismissals are per member or per workspace.

Tests:

- DB-backed API coverage for cross-user isolation, editor write access, viewer
  read-only access if that role is introduced, and duplicate shopping list
  prevention inside a shared workspace.

### Slice 30: Shared Workspace UX

Status: planned.

Goal: make collaboration understandable in the mobile webapp without adding
friction for users with only one personal workspace.

Webapp:

- Add workspace/member management to Settings.
- Keep the workspace switcher hidden or quiet until a user has more than one
  workspace.
- Surface collaborator names/emails only where they help explain shared
  changes.
- Keep the main Home/Categories/Shopping flows focused on the active workspace.

Tests:

- E2E coverage for inviting a member, accepting the invite, editing a shared
  item, and seeing the updated shopping list from both accounts.

### Slice 31: Privacy, Export, And Deletion Hardening

Status: planned.

Goal: make account deletion, export, and privacy rules explicit for shared
spaces before collaboration is considered production-ready.

Backend/product:

- Define what happens when a workspace owner deletes their account.
- Define member removal and ownership transfer rules.
- Decide whether export includes only personal data or all workspaces where the
  user has access.
- Ensure sensitive notes and medicine/hygiene items remain protected by
  membership checks.

Tests:

- API tests for owner deletion, member removal, ownership transfer, export
  boundaries, and revoked access.

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
  Basic dev-auth browser coverage was added later in Slice 26.

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
  - `pnpm test:e2e`. Added later in Slice 26; not part of the original Slice
    13 verification pass.
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
