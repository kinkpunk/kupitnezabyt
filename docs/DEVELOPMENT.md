# Разработка

Руководство по локальной разработке и тестированию. Быстрый старт и навигация
по документации — в корневом `README.md`.

## Основные команды

```bash
pnpm dev             # Запуск api и webapp в режиме разработки
pnpm build           # Production-сборка
pnpm typecheck       # Проверка типов
pnpm lint            # Статический анализ
pnpm test            # Unit- и integration-тесты
pnpm test:e2e        # Полный Playwright e2e-сьют (все specs из tests/e2e)
pnpm test:integration # DB-backed API integration tests
pnpm smoke:deployment # Smoke deployed API/webapp через HTTPS
pnpm smoke:local     # Smoke локальных Docker-контейнеров api/webapp
pnpm smoke:telegram  # Smoke optional Telegram integration (нужен bot token)

pnpm db:generate     # Генерация Prisma Client
pnpm db:migrate      # Применение локальных миграций
pnpm db:deploy       # Применение production migrations
pnpm db:seed         # Добавление стартовых данных
```

## Запуск отдельных сервисов и Docker Compose

Сервисы можно запускать по отдельности:

```bash
pnpm --filter @kupitnezabyt/webapp dev
pnpm --filter @kupitnezabyt/api dev
pnpm --filter @kupitnezabyt/bot dev
pnpm --filter @kupitnezabyt/worker dev
```

Webapp и API можно поднять через compose profile `app`:

```bash
docker compose --profile app up webapp api
```

Telegram bot и worker вынесены в profile `telegram`, потому что требуют реальный
`TELEGRAM_BOT_TOKEN`, публичный `TELEGRAM_WEBAPP_URL`, доступ к Telegram API и
постоянно запущенный процесс:

```bash
docker compose --profile telegram up bot worker
```

## Тестирование

### E2E и integration-сьюты

`pnpm test:e2e` запускает весь Playwright-сьют против dev webapp/API и
требует локальную PostgreSQL базу, миграции и `DEV_AUTH_ENABLED=true`. Сьют
включает основной продуктовый flow (`web-first-product-flow.spec.ts`),
вспомогательные сценарии (`secondary-flows.spec.ts`, `item-sort.spec.ts`,
`item-reorder.spec.ts`), collaboration beta (`workspace-collaboration.spec.ts`)
и визуальные спеки со снапшотами (`*-visual.spec.ts`). `pnpm
test:integration` запускает DB-backed API сценарии с
`RUN_DB_INTEGRATION_TESTS=1`; обычный `pnpm test` остается быстрым и не требует
живой базы.

Для E2E webapp, API и Playwright по умолчанию используют один origin-набор:
`E2E_BASE_URL=http://localhost:3000`,
`NEXT_PUBLIC_API_BASE_URL=http://localhost:3001` и `E2E_API_PORT=3001`.

### Preflight локальной базы

Обе DB-команды начинаются с preflight `scripts/check-local-db.mjs`: если
PostgreSQL недоступен по `DATABASE_URL` (по умолчанию `localhost:5432`), команда
сразу завершается с инструкцией, а не падает внутри тестов или по таймауту.
Поднять базу локально можно так:

```bash
docker compose up -d postgres
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/kupitnezabyt \
  corepack pnpm db:deploy
```

### Запуск тестов внутри Docker

Чтобы проверять код в окружении, близком к CI, поднимите сервисы через
Docker Compose и выполняйте тесты внутри контейнеров:

```bash
# Поднять PostgreSQL, Redis, API и webapp.
docker compose --profile app up -d --wait

# Unit-тесты API внутри контейнера api.
docker compose exec api corepack pnpm test

# DB-backed integration-тесты внутри контейнера api.
docker compose exec api sh -lc \
  "DATABASE_URL=postgresql://postgres:postgres@postgres:5432/kupitnezabyt RUN_DB_INTEGRATION_TESTS=1 corepack pnpm vitest run apps/api/src/db-backed.integration.test.ts"

# Smoke-тест поднятых локальных контейнеров.
pnpm smoke:local
```

### Обновление linux-снапшотов Playwright

Визуальные e2e-спеки (`tests/e2e/*-visual.spec.ts`) сравнивают скриншоты со
снапшотами под ту платформу, где запущен тест. CI работает на linux, поэтому
после изменений, влияющих на визуальные спеки (разметка, стили, шрифты, flow
онбординга), нужно перегенерировать и закоммитить `*-linux.png`. Скрипт

```bash
./scripts/update-linux-snapshots.sh
```

поднимает контейнер `mcr.microsoft.com/playwright`, ставит зависимости,
запускает визуальные спеки с `--update-snapshots`, затем чистый прогон для
проверки и копирует результат обратно в репозиторий. Требует запущенный Docker
и локальную PostgreSQL (как для `pnpm test:e2e`).

Команды в этом документе должны соответствовать `package.json`. При изменении
scripts документацию нужно обновить в той же задаче.
