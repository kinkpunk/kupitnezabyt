# API

This document tracks the implemented API surface. Slice 1 intentionally covers
only the category -> item -> status -> shopping list flow.

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
POST /api/items/:id/status
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

## Shopping List

```http
GET /api/shopping-list
POST /api/shopping-list/:id/complete
```

Completing a shopping list entry linked to an item marks the entry completed and
sets the item back to `IN_STOCK`.

## Service

```http
GET /health
```
