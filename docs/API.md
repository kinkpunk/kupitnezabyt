# API

This document tracks the implemented API surface. The current implementation
covers the core product flow with development auth, email magic link auth,
Google sign-in, Apple sign-in, and optional Telegram-compatible auth. The
release target is browser auth through email magic links and configured OAuth
providers; Telegram auth remains optional integration.

## Auth

```http
POST /api/auth/dev
```

Development-only endpoint. It is available only when `NODE_ENV=development` and
`DEV_AUTH_ENABLED=true`.

```json
{
  "telegramUserId": "local",
  "firstName": "Dev"
}
```

```http
POST /api/auth/telegram
```

Optional Telegram integration auth boundary for Telegram Mini App `initData`.
The backend validates the Telegram signature and returns the same bearer token
shape as dev auth.

```json
{
  "initData": "..."
}
```

Web-first auth endpoints:

```http
POST /api/auth/email/request
POST /api/auth/email/verify
POST /api/auth/google/start
GET /api/auth/google/callback
POST /api/auth/apple/start
POST /api/auth/apple/callback
```

Auth start/request endpoints are rate-limited. Excess requests return `429`
with a generic `RATE_LIMITED` error.

Request body:

```json
{
  "email": "user@example.com"
}
```

The request endpoint returns a generic success response whether or not an
account already exists, creates a short-lived one-time magic link token, stores
only a hash, and sends the raw link through the configured email provider.

Verify body:

```json
{
  "token": "..."
}
```

`POST /api/auth/email/verify` consumes a valid token exactly once, creates or
updates the user for that email, and returns the same bearer token/session shape
as other auth exchanges.

`POST /api/auth/google/start` returns:

```json
{
  "authUrl": "https://accounts.google.com/o/oauth2/v2/auth?..."
}
```

The webapp redirects the browser to `authUrl`. Google then redirects back to
`GET /api/auth/google/callback`. The callback validates OAuth state, exchanges
the authorization code, verifies the Google ID token, resolves or creates the
user, and redirects to the webapp with a short callback result. The webapp stores
the returned bearer token in the same client-side session slot used by magic
links.

Production note: Google sign-in is enabled for the deployed MVP through Google
Auth Platform in testing mode. Only Google accounts added as test users can use
the OAuth flow until the app is published or verified.

`POST /api/auth/apple/start` returns:

```json
{
  "authUrl": "https://appleid.apple.com/auth/authorize?..."
}
```

The webapp redirects the browser to `authUrl`. Apple posts back to
`POST /api/auth/apple/callback` with `response_mode=form_post`. The callback
validates OAuth state, exchanges the authorization code with a server-generated
Apple client secret JWT, verifies the Apple ID token issuer, audience, nonce and
expiry, resolves or creates the user, and redirects to the webapp with the same
callback result shape used by Google. Apple may return private relay emails,
and display name is not stored from the ID token because Apple usually provides
name only during the first authorization response.

Auth exchange endpoints return:

```json
{
  "token": "...",
  "user": {}
}
```

All endpoints below require:

```http
Authorization: Bearer <token>
```

## Me

```http
GET    /api/me
DELETE /api/me
```

`DELETE /api/me` deletes the authenticated user. Related user data is removed
through database cascades and becomes inaccessible through the API. Account
deletion is rate-limited per authenticated user.

## Categories

```http
GET /api/categories
GET /api/categories?archived=true
POST /api/categories
POST /api/categories/reorder
GET /api/categories/:id
PATCH /api/categories/:id
POST /api/categories/:id/archive
POST /api/categories/:id/restore
DELETE /api/categories/:id
```

Reorder body:

```json
{
  "categoryIds": ["category-2", "category-1"]
}
```

`POST /api/categories/reorder` updates `sortOrder` for active categories owned
by the authenticated user and returns the active category list in persisted
order. The payload must include every active category exactly once. Unknown,
archived, duplicate, incomplete, or cross-user ids are rejected.

Create body:

```json
{
  "name": "Аптека",
  "icon": "💊"
}
```

## Items

```http
GET /api/items
GET /api/items?archived=true
GET /api/items/search?q=...
POST /api/items
GET /api/items/:id
PATCH /api/items/:id
POST /api/items/:id/status
POST /api/items/:id/snooze
POST /api/items/:id/archive
POST /api/items/:id/restore
DELETE /api/items/:id
```

Create body:

```json
{
  "categoryId": "...",
  "name": "Ибупрофен",
  "brand": "optional",
  "notes": "optional",
  "usageCycleDays": 30
}
```

Status body:

```json
{
  "status": "NEED_BUY"
}
```

Supported statuses:

```text
IN_STOCK
LOW
NEED_BUY
URGENT
PAUSED
```

Changing status is transactional: the item is updated and the linked shopping
list entry is created, updated, or completed according to product rules.

Search matches active, non-archived items by item `name`, `brand`, `notes`, and
category name. Results are scoped to the authenticated user and limited to 50
items.

Snooze body:

```json
{
  "days": 3
}
```

Snoozing sets `Item.nextCheckAt` to `now + days` and recreates the pending
`ITEM_CHECK` reminder data. In the web-first MVP this powers in-app reminders;
optional external Telegram delivery is handled by `apps/worker` only when that
integration is deployed.

Update body:

```json
{
  "name": "Ибупрофен",
  "categoryId": "...",
  "brand": "optional",
  "notes": "optional",
  "usageCycleDays": 30,
  "nextCheckAt": "2026-06-28T12:00:00.000Z",
  "reminderEnabled": true
}
```

All update fields are optional. Omitted fields are preserved. Sending
`usageCycleDays` without `nextCheckAt` recalculates the next check date from the
current item status; sending `nextCheckAt: null` clears the explicit schedule.
Archiving an item also completes its open shopping list entry.

```http
GET /api/reminders/in-app
GET /api/reminders/in-app?days=7
```

Returns due and upcoming in-app reminders scoped to the authenticated user.
The response includes item, category, and group checks whose reminders are
enabled and whose `nextCheckAt` is due or falls inside the requested upcoming
window.

```json
[
  {
    "id": "ITEM:item-id",
    "entityId": "item-id",
    "entityType": "ITEM",
    "title": "Кофе",
    "nextCheckAt": "2026-06-28T12:00:00.000Z",
    "timing": "UPCOMING"
  }
]
```

`PATCH /api/categories/:id`, `PATCH /api/groups/:id`, and
`PATCH /api/items/:id` accept `usageCycleDays`, `nextCheckAt`, and
`reminderEnabled` so the webapp can configure check settings without renaming
the entity.

`GET /api/categories?archived=true` and `GET /api/items?archived=true` return
archived records for the authenticated user. Restoring a category also restores
items that were archived by that category archive action. Restoring an item
requires its category to be active. Deleting categories or items through these
endpoints is allowed only for archived records. Deleting an active owned
category or item returns `409` with `CATEGORY_NOT_ARCHIVED` or
`ITEM_NOT_ARCHIVED`; unknown or cross-user ids still return `404`.

## Shopping List

```http
GET /api/shopping-list
POST /api/shopping-list
PATCH /api/shopping-list/:id
POST /api/shopping-list/:id/complete
DELETE /api/shopping-list/:id
DELETE /api/shopping-list/completed
```

Completing a shopping list entry linked to an item marks the entry completed and
sets the item back to `IN_STOCK`.

Manual entries are created without `itemId`:

```json
{
  "title": "Молоко",
  "categoryId": "...",
  "priority": "NORMAL"
}
```

`categoryId` is optional. `priority` can be `NORMAL` or `URGENT` and defaults to
`NORMAL`.

Manual entries can be updated and deleted. Shopping list entries linked to a
tracked item are managed by item status and cannot be manually patched or
deleted through the shopping list endpoints.

Deleting completed entries removes only completed shopping list rows for the
current authenticated user.

## Groups

```http
GET    /api/groups
POST   /api/groups
GET    /api/groups/:id
PATCH  /api/groups/:id
POST   /api/groups/:id/archive
POST   /api/groups/:id/items
DELETE /api/groups/:id/items/:itemId
```

Create/update body:

```json
{
  "name": "Аптечка",
  "icon": "optional"
}
```

Add item body:

```json
{
  "itemId": "..."
}
```

Group membership is unique by `(groupId, itemId)`.

## Recommendations

```http
GET  /api/recommendations?itemId=...
POST /api/recommendations/:id/accept
POST /api/recommendations/:id/dismiss
POST /api/recommendations/:id/hide-similar
```

Recommendations are deterministic rule-based suggestions generated from the
authenticated user's existing items. No LLM or external recommendation service
is used.

`GET /api/recommendations?itemId=...` returns up to five suggestions for an
active item owned by the current user:

```json
[
  {
    "id": "...",
    "ruleId": "coffee-basics",
    "suggestedItem": "Фильтры для кофе",
    "categoryHint": "Продукты"
  }
]
```

`POST /api/recommendations/:id/accept` creates the suggested item only after
explicit user action. Body is optional:

```json
{
  "categoryId": "..."
}
```

When `categoryId` is omitted, the API adds the item to the trigger item's
category. The backend recalculates the recommendation, suppresses duplicates by
normalized name, and never trusts user identity from the body or query string.

`POST /api/recommendations/:id/dismiss` stores a dismissal for the current user
so the same rule suggestion is not shown again:

```json
{
  "dismissed": true
}
```

`POST /api/recommendations/:id/hide-similar` stores a rule-family dismissal for
the current user so all current suggestions from the same rule are hidden:

```json
{
  "hidden": true,
  "ruleId": "coffee-basics"
}
```

Recommendation dismissals are scoped by the authenticated user. A family
dismissal uses the same deterministic rule cycle semantics as single-suggestion
dismissal: suggestions can appear again after a new relevant item cycle starts.

## Export

```http
GET /api/export/json
```

Exports authenticated user data as JSON:

```json
{
  "schemaVersion": 1,
  "exportedAt": "2026-06-16T20:00:00.000Z",
  "data": {
    "user": {},
    "categories": [],
    "items": [],
    "shoppingListItems": [],
    "reminders": [],
    "groups": [],
    "checkSessions": [],
    "recommendationDismissals": []
  }
}
```

The export endpoint is read-only, rate-limited per authenticated user, and
always uses the bearer auth context.

## Check Sessions

```http
POST /api/check/category/:categoryId/start
POST /api/check/group/:groupId/start
GET  /api/check/session/active
GET  /api/check/session/:sessionId
POST /api/check/session/:sessionId/item/:itemId/status
POST /api/check/session/:sessionId/complete
POST /api/check/session/:sessionId/cancel
```

`GET /api/check/session/active` returns the latest unfinished check session for
the authenticated user, or `null` when there is no active session.

Starting a category check session snapshots active, non-archived, non-`PAUSED`
items from the category. Starting a group check session snapshots active,
non-archived, non-`PAUSED` items from that group. Updating an item status reuses
the same backend item status workflow as the webapp cards and bot callbacks.

Status body:

```json
{
  "status": "LOW"
}
```

Supported check statuses:

```text
IN_STOCK
LOW
NEED_BUY
URGENT
```

## Errors

Errors use this shape:

```json
{
  "error": {
    "code": "ITEM_NOT_FOUND",
    "message": "Item was not found."
  }
}
```

## Service

```http
GET /health
GET /health/detailed
```

`GET /health` is a lightweight liveness check for platform health probes.
`GET /health/detailed` additionally checks database connectivity and returns
`503` when Postgres is unavailable. It is intended for deployment smoke and
manual diagnostics.
