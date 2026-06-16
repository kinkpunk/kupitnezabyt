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
