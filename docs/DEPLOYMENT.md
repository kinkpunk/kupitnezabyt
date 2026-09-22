# Deployment

Точка входа для deployment-документации: текущая production-топология,
smoke-процедуры и настройка OAuth-провайдеров. Платформенные инструкции живут
в отдельных документах, на которые здесь даны ссылки.

## Текущий production: Render + Vercel + Neon

- webapp — https://kupitnezabyt-webapp.vercel.app;
- API — https://kupitnezabyt-api.onrender.com;
- база — Neon PostgreSQL.

Полная инструкция: `docs/RENDER_VERCEL_NEON_DEPLOYMENT.md` (топология,
переменные окружения сервисов, migration job, Vercel webapp, smoke checklist,
известные ограничения).

Smoke пройден 2026-07-21: API health/detailed OK, `db: true`, webapp отвечает
HTML.

## Целевой staging: Northflank + Vercel

Альтернативная free-friendly топология (2 free services + PostgreSQL addon,
always-on compute без sleeping):

- webapp — Vercel;
- API и PostgreSQL — Northflank.

Полная инструкция: `docs/NORTHFLANK_VERCEL_DEPLOYMENT.md` (настройка сервисов,
миграция данных с Neon, обновление OAuth-провайдеров, smoke checklist,
rollback).

## Smoke-тесты

Автоматический smoke deployed окружений:

```bash
DEPLOYED_API_BASE_URL=https://kupitnezabyt-api.onrender.com \
DEPLOYED_WEBAPP_URL=https://kupitnezabyt-webapp.vercel.app \
  corepack pnpm smoke:deployment
```

Скрипт проверяет health/detailed API (`db: true`) и что webapp отвечает HTML.
После автоматического smoke пройдите ручной auth/product checklist:

- production (Render): `docs/RENDER_VERCEL_NEON_DEPLOYMENT.md` →
  «Smoke Checklist»;
- staging (Northflank): `docs/NORTHFLANK_VERCEL_DEPLOYMENT.md` →
  «Smoke Checklist».

Локальный smoke Docker-контейнеров — `pnpm smoke:local`, см.
`docs/DEVELOPMENT.md`. Optional Telegram integration smoke — `pnpm
smoke:telegram`, чеклист в `docs/NORTHFLANK_VERCEL_DEPLOYMENT.md` →
«Telegram Integration Smoke».

## OAuth-провайдеры

Google sign-in — основной способ входа в production; email magic link и Apple
sign-in — дополнительные. Общая таблица переменных окружения — в `README.md`
(«Переменные окружения»).

### Google (основной)

- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` —
  задаются на API-сервисе (Render/Northflank); callback URL в Google Auth
  Platform должен совпадать с `GOOGLE_REDIRECT_URI`.
- Если publishing status в Google Auth Platform всё ещё `Testing`,
  Google-аккаунт каждого нового тестера нужно предварительно добавить в
  Test users, иначе он не сможет пройти OAuth.

### Apple (дополнительный)

- `APPLE_CLIENT_ID`, `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY`,
  `APPLE_REDIRECT_URI`.
- Код готов и проверен на уровне приложения; провайдер включается после
  настройки Apple Developer и env vars на хостинге. Чеклист:
  `docs/NORTHFLANK_VERCEL_DEPLOYMENT.md` → «Apple Sign-In Enablement
  Checklist».

### Email magic link (дополнительный)

- `EMAIL_FROM`, `EMAIL_PROVIDER_API_KEY`, `MAGIC_LINK_TOKEN_TTL_MINUTES`.

## Миграции базы

В deployed окружениях миграции применяются через `corepack pnpm db:deploy`
(Prisma `migrate deploy`), для разовых migration job — direct connection
string провайдера. Детали по платформам: «Migration Job» в
`docs/RENDER_VERCEL_NEON_DEPLOYMENT.md`, «Database Migrations» и «Data
Migration From Neon» в `docs/NORTHFLANK_VERCEL_DEPLOYMENT.md`.
