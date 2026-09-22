# kupitnezabyt

`kupitnezabyt` - устанавливаемое PWA (mobile-first web app) для учета регулярно расходуемых товаров и бытовых запасов.

Сервис помогает хранить персональные категории товаров, отмечать текущие запасы, вовремя проверять остатки и автоматически формировать список покупок. Это не обычный разовый список покупок, а инструмент для управления повторяющимися потребностями: продуктами, лекарствами, косметикой, бытовой химией, товарами для дома, питомцев, автомобиля и хобби.

## Статус проекта

Реализовано основное вертикальное ядро MVP из `docs/IMPLEMENTATION_ROADMAP.md`:
категории и товары, статусы запасов, автоматический список покупок, in-app
reminders и проверки запасов, рекомендации, поиск, экспорт данных и
collaboration beta. Это еще не полное соответствие `docs/PRODUCT_SPEC.md`.

Текущий фокус: устанавливаемое PWA с входом через Google-аккаунт
(дополнительно: Apple Sign In и email magic link) и in-app reminders; Telegram
Mini App и bot остаются optional integration. Текущий MVP scope, оставшиеся
расхождения с PRODUCT_SPEC и статус collaboration beta — в разделе «Roadmap
Status» файла `docs/IMPLEMENTATION_ROADMAP.md`.

## Вне MVP

В первую версию не входят: интеграции с магазинами и мониторинг цен, сканирование
чеков и штрих-кодов, AI- или ML-рекомендации, подписки и платежи, нативные
приложения и сложная аналитика расходов. Полный список исключений и backlog
после MVP — в `docs/PRODUCT_SPEC.md` (§ 18–19).

## Документация

- `docs/PRODUCT_SPEC.md` - продуктовое и техническое задание;
- `docs/API.md` - описание API;
- `docs/ARCHITECTURE.md` - архитектурные решения;
- `docs/IMPLEMENTATION_ROADMAP.md` - roadmap реализации и manual checklist'ы;
- `docs/FINAL_INTEGRATION.md` - финальный MVP integration checklist;
- `docs/DESIGN-SYSTEM.md` - дизайн-токены и правила UI webapp;
- `docs/DEVELOPMENT.md` - локальная разработка и тестирование: команды,
  Docker-сценарии, Playwright-снапшоты;
- `docs/DEPLOYMENT.md` - deployment-индекс: production/staging топология
  (Northflank/Vercel и Render/Vercel/Neon), OAuth configuration, smoke-тесты;
- `AGENTS.md` - правила работы Codex и других AI-агентов с репозиторием.

Если реализация расходится с документацией, сначала нужно проверить `docs/PRODUCT_SPEC.md`, а затем обновить устаревший документ вместе с кодом.

## Технологический стек

- Web: Next.js, React, TypeScript, mobile-first browser UI (устанавливаемое PWA).
- Backend: Node.js, TypeScript, Fastify, Prisma ORM, PostgreSQL.
- Optional Telegram integration: grammY, Telegram WebApp runtime API.
- Инструменты: pnpm workspaces, Docker Compose, ESLint, Vitest, Playwright
  (browser e2e и визуальные снапшоты).

## Структура репозитория

```text
/
  apps/
    webapp/             # mobile web UI
    api/                # Backend API
    bot/                # optional Telegram-бот
    worker/             # optional Telegram reminder worker
  packages/
    database/           # Prisma schema, migrations и database client
    shared/             # Общие типы и бизнес-логика
  docs/                # документация проекта
  tests/
    e2e/                # Playwright-сценарии и визуальные снапшоты
  scripts/              # smoke-тесты, preflight БД, обновление linux-снапшотов
  docker-compose.yml
  pnpm-workspace.yaml
  playwright.config.ts
  .env.example
  AGENTS.md
  README.md
```

## Локальный запуск

Требования: Node.js 22 LTS (или версия из `.nvmrc`), pnpm 10 (или версия из
`packageManager`), Docker с поддержкой Docker Compose. Локальный режим
авторизации разрешен только при `NODE_ENV=development`; в production он должен
быть выключен.

### 1. Установить зависимости

```bash
pnpm install
```

### 2. Настроить окружение

```bash
cp .env.example .env
```

Заполнить обязательные переменные по `.env.example` (см. таблицу «Переменные
окружения» ниже). Не добавляйте реальные секреты в `.env.example` и не
сохраняйте `.env` в репозитории.

### 3. Запустить PostgreSQL и Redis

```bash
docker compose up -d postgres redis
```

### 4. Подготовить базу данных

```bash
pnpm db:generate
pnpm db:migrate
pnpm db:seed
```

### 5. Запустить проект

```bash
pnpm dev
```

После запуска webapp доступен на `http://localhost:3000`, API — на
`http://localhost:3001` (health check: `http://localhost:3001/health`).

Запуск отдельных сервисов и сценарии Docker Compose (profile `app` для
webapp/api, profile `telegram` для optional bot/worker) — см.
`docs/DEVELOPMENT.md`.

## Основные команды

```bash
pnpm dev             # Запуск api и webapp в режиме разработки
pnpm build           # Production-сборка
pnpm typecheck       # Проверка типов
pnpm lint            # Статический анализ
pnpm test            # Unit- и integration-тесты
pnpm test:e2e        # Полный Playwright e2e-сьют
pnpm db:migrate      # Применение локальных миграций
pnpm db:seed         # Добавление стартовых данных
```

Полный список команд (smoke-тесты, `pnpm db:generate`, `pnpm db:deploy`,
`pnpm test:integration`) и тестовые сьюты — в `docs/DEVELOPMENT.md`.

## Переменные окружения

| Переменная | Назначение | Обязательна |
| --- | --- | --- |
| `DATABASE_URL` | Подключение к PostgreSQL | Да |
| `REDIS_URL` | Подключение к Redis | Только для legacy/optional queue flows |
| `JWT_SECRET` | Подпись серверной сессии | Да |
| `APP_BASE_URL` | Базовый URL приложения | Да |
| `NEXT_PUBLIC_API_BASE_URL` | URL API для webapp | Да для webapp |
| `API_PORT` | Порт API | Нет |
| `NODE_ENV` | Режим запуска | Да |
| `DEV_AUTH_ENABLED` | Локальная авторизация без Telegram | Только для разработки |
| `EMAIL_FROM` | From-адрес для magic links | Да для email magic link auth |
| `EMAIL_PROVIDER_API_KEY` | API key email-провайдера | Да для email magic link auth |
| `MAGIC_LINK_TOKEN_TTL_MINUTES` | TTL magic link токена | Нет |
| `GOOGLE_CLIENT_ID` | Google OAuth Web Client ID | Только если включен Google sign-in |
| `GOOGLE_CLIENT_SECRET` | Google OAuth Client Secret | Только если включен Google sign-in |
| `GOOGLE_REDIRECT_URI` | Callback URL API для Google OAuth | Только если включен Google sign-in |
| `APPLE_CLIENT_ID` | Apple Services ID / OAuth client id | Только если включен Apple sign-in |
| `APPLE_TEAM_ID` | Apple Developer Team ID | Только если включен Apple sign-in |
| `APPLE_KEY_ID` | Apple private key id | Только если включен Apple sign-in |
| `APPLE_PRIVATE_KEY` | Apple `.p8` private key PEM | Только если включен Apple sign-in |
| `APPLE_REDIRECT_URI` | Callback URL API для Apple OAuth | Только если включен Apple sign-in |
| `TELEGRAM_BOT_TOKEN` | Токен Telegram-бота | Только optional Telegram integration |
| `TELEGRAM_BOT_USERNAME` | Username Telegram-бота | Только optional Telegram integration |
| `TELEGRAM_WEBAPP_URL` | Публичный URL Mini App | Только optional Telegram integration |

Google sign-in — основной рабочий способ входа в production; email magic link
и Apple sign-in — дополнительные. Production URLs, настройка OAuth-провайдеров
и smoke-тесты — см. `docs/DEPLOYMENT.md`.

## Ключевая бизнес-логика

У товара есть четыре статуса:

| Статус | Значение | Поведение |
| --- | --- | --- |
| `IN_STOCK` | Есть запас | Рассчитать следующую проверку |
| `LOW` | Осталось мало | Назначить повторную проверку через 3 дня |
| `NEED_BUY` | Нужно купить | Добавить в список покупок |
| `PAUSED` | Не отслеживать | Не показывать в ближайших проверках |

Backend является источником истины для переходов статусов, расчета `nextCheckAt` и синхронизации списка покупок. Frontend может использовать optimistic update, но не должен дублировать бизнес-правила. Полная бизнес-логика статусов — в `docs/PRODUCT_SPEC.md` (§ 7.4–7.7, § 13).

## Аутентификация

Production MVP использует browser auth: Google sign-in — основной способ входа,
email magic link — доступный fallback, Apple sign-in — готовый provider flow.
Backend создает пользователя и сессию только после проверенного auth exchange,
а Telegram Mini App остается optional integration. Архитектурные правила и
границы — в разделе «Authentication» файла `docs/ARCHITECTURE.md`, endpoints —
в `docs/API.md`.

## Тестирование

Перед завершением задачи выполнять `pnpm typecheck`, `pnpm lint`, `pnpm test`,
`pnpm test:e2e` и `pnpm test:integration`. Минимальный E2E-сценарий MVP покрыт
в `tests/e2e/web-first-product-flow.spec.ts`. Подробности по сьютам, Docker и
снапшотам — в `docs/DEVELOPMENT.md`.

## Принципы разработки

Правила работы с кодом, тестами и документацией зафиксированы в `AGENTS.md`.

## Приватность

Лекарства, средства гигиены и личные заметки считаются чувствительными данными.
MVP поддерживает удаление аккаунта, экспорт данных, изоляцию по `userId` и не
передает данные сторонним AI- и аналитическим сервисам без согласия. Подробности
— в `docs/PRODUCT_SPEC.md`.

## Collaboration beta

Совместные списки реализованы как beta-функция: текущая модель шарит весь
активный workspace, доступны приглашения по email, отзыв приглашения, удаление
доступа и передача владения. Текущий статус и manual checklist — в разделе
«Post-MVP Collaboration Plan» файла `docs/IMPLEMENTATION_ROADMAP.md` (Slice 32).

## Готовность MVP

MVP готово к release-readiness проходу, когда пользователь может войти через
Google-аккаунт, управлять категориями и товарами, получать автоматически
сформированный список покупок и in-app reminders, проходить проверки запасов и
экспортировать свои данные. Критерии приемки — в `docs/PRODUCT_SPEC.md` (§ 17),
оставшиеся задачи — в `docs/IMPLEMENTATION_ROADMAP.md`.
