# API

This document tracks the implemented API surface. The current implementation
covers the first product flow plus Slice 2 CRUD hardening.

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

Production auth boundary for Telegram Mini App `initData`. The backend validates
the Telegram signature and returns the same bearer token shape as dev auth.

```json
{
  "initData": "..."
}
```

Both endpoints return:

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
through database cascades and becomes inaccessible through the API.

## Categories

```http
GET /api/categories
POST /api/categories
GET /api/categories/:id
PATCH /api/categories/:id
POST /api/categories/:id/archive
```

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
GET /api/items/search?q=...
POST /api/items
GET /api/items/:id
PATCH /api/items/:id
POST /api/items/:id/status
POST /api/items/:id/snooze
POST /api/items/:id/archive
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
`ITEM_CHECK` reminder data. It does not send a Telegram message; sending is
handled by later worker slices.

Update body:

```json
{
  "name": "Ибупрофен",
  "categoryId": "...",
  "brand": "optional",
  "notes": "optional",
  "usageCycleDays": 30
}
```

Only `name` is required for the current update endpoint. Optional fields are
preserved when omitted. Archiving an item also completes its open shopping list
entry.

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

The export endpoint is read-only and always uses the bearer auth context.

## Check Sessions

```http
POST /api/check/category/:categoryId/start
POST /api/check/group/:groupId/start
GET  /api/check/session/:sessionId
POST /api/check/session/:sessionId/item/:itemId/status
POST /api/check/session/:sessionId/complete
POST /api/check/session/:sessionId/cancel
```

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
```
