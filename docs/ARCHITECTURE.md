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
