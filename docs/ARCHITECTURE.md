# Architecture

## Slice 1 Scope

The first vertical slice implements only:

```text
Open Mini App
-> create category
-> add item
-> change item status
-> see it in shopping list
-> mark it bought
```

Out of scope for this slice: Telegram bot commands, worker, reminders, groups,
check sessions, recommendations, search, export, onboarding, deployment, and CI.

## Workspace

```text
apps/webapp          Next.js mobile UI
apps/api             Fastify API
apps/bot             grammY Telegram bot entry point
apps/worker          reminder polling and Telegram delivery
packages/database    Prisma schema and client
packages/shared      Shared domain types and pure business logic
```

`packages/ui` is intentionally not created yet because there are no reused UI
components in Slice 1.

## Auth

The API resolves user identity from an authorization context only.

- `POST /api/auth/telegram` validates Telegram Mini App `initData`.
- `POST /api/auth/dev` exists only when `NODE_ENV=development` and
  `DEV_AUTH_ENABLED=true`.
- Authenticated requests use a signed bearer token.
- `userId` from request body or query parameters is never trusted.

## Business Logic

The backend is the source of truth for item status transitions and shopping list
synchronization.

Shared pure functions in `packages/shared` define:

- `calculateNextCheckAt`
- `getShoppingSyncAction`
- status type guards

The API applies those rules inside database transactions. `NEED_BUY` and
`URGENT` create or update one open shopping list entry per item. Returning an
item to `IN_STOCK`, `LOW`, or `PAUSED` completes the open entry.

## Telegram Bot

Slice 3 adds a minimal `apps/bot` service with grammY. It currently implements
only `/start`, `/app`, and `/help`, plus an inline Mini App button. Reminder
messages and callback status actions are intentionally deferred to later slices.

The bot requires `TELEGRAM_BOT_TOKEN` and `TELEGRAM_WEBAPP_URL` when started
directly:

```bash
pnpm --filter @kupitnezabyt/bot dev
```

## Data Model

Slice 1 includes only:

- `User`
- `Category`
- `Item`
- `ShoppingListItem`

The database migration adds a PostgreSQL partial unique index to prevent more
than one open shopping list entry for the same tracked item.

Slice 5 adds reminder scheduling data:

- `Category.usageCycleDays`
- `Category.nextCheckAt`
- `Category.reminderEnabled`
- `Reminder`

Reminder rows include an `idempotencyKey` so later worker slices can avoid
duplicates for the same user, reminder type, entity, and UTC scheduled date.
Slice 5 stores and updates reminder data only; it does not send Telegram
notifications.

Slice 6 adds `apps/worker` for reminder delivery. The worker polls pending
`Reminder` rows, renders item-check notifications, sends them through Telegram
Bot API, and updates reminder status to `SENT`, `FAILED`, or `CANCELLED`.
Temporary failures are retried by moving `scheduledFor` forward with bounded
backoff. User data mutations are not rolled back when Telegram delivery fails.

The worker currently handles `ITEM_CHECK` reminders. Other reminder types are
left for later slices when their product flows exist.

```bash
pnpm --filter @kupitnezabyt/worker dev
```

Worker environment:

```env
TELEGRAM_BOT_TOKEN=
TELEGRAM_WEBAPP_URL=
WORKER_POLL_INTERVAL_MS=300000
REMINDER_BATCH_SIZE=25
REMINDER_MAX_ATTEMPTS=5
```

## Check Sessions

Slice 7 adds guided category checks with `CheckSession` and `CheckSessionItem`.
Starting a category check creates a snapshot of active non-archived,
non-`PAUSED` items. Each status selection calls the same item status workflow
used elsewhere, so shopping list sync and reminder sync remain centralized.

Group check sessions are implemented in Slice 8 after groups are introduced.

## Groups

Slice 8 adds user-defined item groups with `ItemGroup` and `ItemGroupItem`.
Groups are owned by a single user and can include items from any category owned
by that user. Membership is unique by `(groupId, itemId)`.

Group check sessions reuse the same `CheckSession` and `CheckSessionItem`
models introduced for category checks. Starting a group check snapshots active,
non-archived, non-`PAUSED` group items.

Slice 9 adds `RecommendationDismissal` for user-level suppression of dismissed
rule-based suggestions. Recommendation rules are stored in code in
`packages/shared`; they are deterministic, local, and do not call LLMs, analytics
providers, or third-party services.

## Recommendations

Recommendation matching is pure shared business logic:

- `normalizeName` handles casing, spacing, and `ё`/`е` normalization.
- Rule matching checks trigger terms against the changed item name.
- Duplicate suppression compares normalized suggestion names with the user's
  active item names.
- Dismissal suppression compares the current user's stored
  `RecommendationDismissal` rows with rule suggestions.

The API remains the source of truth. Accepting a recommendation recalculates it
server-side before creating an item and returns an existing active item if the
normalized name is already present.

## User Data Management

Slice 10 adds authenticated search, JSON export, and account deletion.

Item search is implemented in the API with Prisma filters over active items
owned by the current user. It matches item name, brand, notes, and category
name, and does not trust any user id from client input.

JSON export returns a versioned envelope with the authenticated user's current
data: user profile, categories, items, shopping list entries, reminders, groups,
check sessions, and recommendation dismissals. The export is read-only and does
not send data to third-party services.

Account deletion deletes the `User` row. User-owned data is removed through the
existing cascade relations and therefore becomes inaccessible to future API
requests.

## Product Polish

Slice 11 keeps onboarding state in the webapp `localStorage` instead of adding
database fields. The onboarding flow can create starter categories and first
items through the same authenticated API endpoints used by the main category
screen.

The webapp now opens on a home screen with readiness, active shopping count,
urgent items, upcoming item checks, and quick category access. The main mobile
navigation is limited to five product sections: home, categories, shopping,
check, and settings. Search and groups remain available from quick actions so
their existing flows are preserved without adding a shared UI package.

## UI Package Decision

Slice 12 intentionally does not create `packages/ui`. The current UI surface is
implemented by a single Next.js webapp, and the repeated controls are still
local to one page plus one stylesheet. Introducing a workspace package now would
add build surface without real cross-package reuse.

Create `packages/ui` later only when stable components are reused across
multiple files or applications, for example shared buttons, inputs, status
badges, bottom navigation, modals, or confirmation dialogs.
