# kupitnezabyt

`kupitnezabyt` - mobile-first web app для учета регулярно расходуемых товаров и бытовых запасов.

Сервис помогает хранить персональные категории товаров, отмечать текущие запасы, вовремя проверять остатки и автоматически формировать список покупок. Это не обычный разовый список покупок, а инструмент для управления повторяющимися потребностями: продуктами, лекарствами, косметикой, бытовой химией, товарами для дома, питомцев, автомобиля и хобби.

## Статус проекта

Core MVP slices implemented: реализовано основное вертикальное ядро продукта из
`docs/IMPLEMENTATION_ROADMAP.md`, но это еще не означает полного соответствия
всем требованиям `docs/PRODUCT_SPEC.md`.

Текущий продуктовый фокус изменен: MVP становится web-first приложением с
email magic link авторизацией и in-app reminders. Telegram Mini App и Telegram
bot остаются optional integration/future work, потому что постоянные bot/worker
процессы требуют платной инфраструктуры на текущем хостинге.

Основной интерфейс должен открываться в обычном мобильном браузере. Приложение
может быть добавлено на домашний экран как browser/PWA-like experience без
обязательного offline-first режима.

## Реализованное ядро MVP

- пользовательские категории;
- добавление и редактирование регулярно покупаемых товаров;
- быстрые статусы `Есть`, `Мало`, `Купить`, `Срочно`;
- автоматическое формирование списка покупок;
- отметка товара как купленного;
- расчет ближайших проверок и in-app reminders;
- пошаговый режим проверки запасов;
- наборы связанных товаров;
- rule-based рекомендации;
- поиск по товарам;
- экспорт пользовательских данных в JSON;
- collaboration beta для совместных списков: workspace API, приглашения по
  email, переключение активного списка, управление участниками, удаление
  доступа и передача владения в настройках.

## Текущий web-first MVP scope

- email magic link авторизация реализована;
- Google sign-in реализован и проверен в production;
- Apple sign-in реализован на уровне приложения и готов к provider setup/smoke;
- browser session использует bearer/JWT после magic link verify;
- завершение onboarding хранится на backend и не требует повторного прохождения
  после нового входа;
- home/settings UI для in-app reminders реализован;
- настройка `usageCycleDays`, `nextCheckAt` и `reminderEnabled` в UI
  реализована для товаров, категорий и наборов;
- управление важностью товара (`importance`: `LOW`/`NORMAL`/`HIGH`/`CRITICAL`)
  реализовано в API и UI; важность — хранимый атрибут и не влияет на логику
  статусов и списка покупок;
- continued browser smoke на deployed HTTPS URL без Telegram credentials;
- collaboration beta можно показывать пользователям после отдельного
  двухаккаунтного smoke-теста: приглашение, принятие, переключение списка,
  совместное редактирование, удаление доступа и передача владения;
- Telegram auth/bot/reminder delivery оставить выключаемой optional integration.
- совместные списки остаются beta/hardening track относительно core MVP:
  основная функциональность реализована, но перед широким включением нужно
  закрыть production smoke, edge-case UX и расширенное двухаккаунтное покрытие.

## Оставшиеся расхождения с PRODUCT_SPEC

`docs/PRODUCT_SPEC.md` остается источником полного продуктового и технического
задания. После web-first pivot реализованное ядро MVP пока не закрывает:

- дополнительное покрытие краевых случаев для уже существующих e2e-сценариев
  (основной flow, проверки, поиск, архив, экспорт, сортировка и collaboration
  beta покрыты в `tests/e2e/`, DB-backed API сценарии — в
  `apps/api/src/db-backed.integration.test.ts`);
- расширенное двухаккаунтное e2e-покрытие collaboration beta и понятный UX для
  приглашения пользователей, которые уже входили в сервис;
- optional Telegram integration smoke, если позже появится платный bot/worker
  deployment или другой бесплатный способ постоянного запуска.

## Вне MVP

В первую версию не входят:

- интеграции с магазинами;
- мониторинг цен и скидок;
- сканирование чеков и штрих-кодов;
- AI- или ML-рекомендатель;
- расширенные семейные аккаунты с тонкими ролями, несколькими владельцами,
  аудитом изменений и отдельными privacy/export режимами поверх текущей
  collaboration beta;
- подписки и платежи;
- нативные приложения для iOS и Android;
- сложная аналитика расходов.

## Документация

- `docs/PRODUCT_SPEC.md` - продуктовое и техническое задание;
- `docs/API.md` - описание API;
- `docs/ARCHITECTURE.md` - архитектурные решения;
- `docs/IMPLEMENTATION_ROADMAP.md` - roadmap реализации и manual checklist'ы;
- `docs/FINAL_INTEGRATION.md` - финальный MVP integration checklist;
- `docs/NORTHFLANK_VERCEL_DEPLOYMENT.md` - целевой staging/production
  deployment: Vercel webapp, Northflank API и PostgreSQL;
- `docs/RENDER_VERCEL_NEON_DEPLOYMENT.md` - текущий production deployment:
  Render API, Vercel webapp и Neon PostgreSQL;
- `docs/DESIGN-SYSTEM.md` - дизайн-токены и правила UI webapp;
- `AGENTS.md` - правила работы Codex и других AI-агентов с репозиторием.

Если реализация расходится с документацией, сначала нужно проверить `docs/PRODUCT_SPEC.md`, а затем обновить устаревший документ вместе с кодом.

## Технологический стек

### Web

- Next.js;
- React;
- TypeScript;
- mobile-first browser UI.

### Backend

- Node.js;
- TypeScript;
- Fastify;
- Prisma ORM;
- PostgreSQL.

### Optional Telegram integration

- grammY;
- Telegram WebApp runtime API;
- прямой polling напоминаний из PostgreSQL.

### Инструменты

- pnpm workspaces;
- Docker Compose;
- ESLint;
- TypeScript;
- Vitest;
- Playwright (browser e2e и визуальные снапшоты).

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
  docs/
    PRODUCT_SPEC.md
    API.md
    ARCHITECTURE.md
    IMPLEMENTATION_ROADMAP.md
    FINAL_INTEGRATION.md
    NORTHFLANK_VERCEL_DEPLOYMENT.md
    RENDER_VERCEL_NEON_DEPLOYMENT.md
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

## Требования для локального запуска

Перед началом работы потребуются:

- Node.js 22 LTS или версия, указанная в `.nvmrc`;
- pnpm 10 или версия, указанная в поле `packageManager`;
- Docker с поддержкой Docker Compose.

Локальный режим авторизации разрешен только при `NODE_ENV=development`. В
production он должен быть выключен; основной production вход сейчас использует
email magic link.

## Локальный запуск

### 1. Установить зависимости

```bash
pnpm install
```

### 2. Настроить окружение

```bash
cp .env.example .env
```

Заполнить обязательные переменные:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/kupitnezabyt
REDIS_URL=redis://localhost:6379

JWT_SECRET=
APP_BASE_URL=http://localhost:3000
NEXT_PUBLIC_API_BASE_URL=http://localhost:3001
API_PORT=3001
NODE_ENV=development

# Web-first auth.
EMAIL_FROM=
EMAIL_PROVIDER_API_KEY=
MAGIC_LINK_TOKEN_TTL_MINUTES=15

# Optional Telegram integration.
TELEGRAM_BOT_TOKEN=
TELEGRAM_BOT_USERNAME=
TELEGRAM_WEBAPP_URL=http://localhost:3000

# Только для локальной разработки.
DEV_AUTH_ENABLED=true
```

Не добавляйте реальные секреты в `.env.example` и не сохраняйте `.env` в репозитории.

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

После запуска:

- webapp: `http://localhost:3000`;
- API: `http://localhost:3001`;
- API health check: `http://localhost:3001/health`;
- API detailed health check with database connectivity:
  `http://localhost:3001/health/detailed`.

При необходимости сервисы можно запускать отдельно:

```bash
pnpm --filter @kupitnezabyt/webapp dev
pnpm --filter @kupitnezabyt/api dev
pnpm --filter @kupitnezabyt/bot dev
pnpm --filter @kupitnezabyt/worker dev
```

### Альтернатива: запуск через Docker Compose

Инфраструктуру можно поднять отдельно:

```bash
docker compose up -d postgres redis
```

Webapp и API можно запускать через compose profile `app`:

```bash
docker compose --profile app up webapp api
```

Telegram bot и worker остаются optional integration и вынесены в profile
`telegram`, потому что требуют реальный `TELEGRAM_BOT_TOKEN`, публичный
`TELEGRAM_WEBAPP_URL`, доступ к Telegram API и постоянно запущенный процесс:

```bash
docker compose --profile telegram up bot worker
```

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

Команды в этом разделе должны соответствовать `package.json`. При изменении
scripts README нужно обновить в той же задаче.

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
| `EMAIL_FROM` | From-адрес для magic links | Да для web-first auth |
| `EMAIL_PROVIDER_API_KEY` | API key email-провайдера | Да для web-first auth |
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

Google sign-in — основной рабочий способ входа в production: реальные
пользователи авторизуются через него. Если в Google Auth Platform publishing
status всё ещё `Testing`, Google-аккаунт каждого нового тестера нужно
предварительно добавить в Test users, иначе он не сможет пройти OAuth.

Текущий production: webapp — https://kupitnezabyt-webapp.vercel.app,
API — https://kupitnezabyt-api.onrender.com (Render + Vercel + Neon,
см. `docs/RENDER_VERCEL_NEON_DEPLOYMENT.md`). Smoke пройден 2026-07-21:
API health/detailed OK, `db: true`, webapp отвечает HTML.

Для deployed окружений используйте `corepack pnpm smoke:deployment` с
`DEPLOYED_API_BASE_URL` и `DEPLOYED_WEBAPP_URL`, затем проходите ручной
auth/product smoke из `docs/RENDER_VERCEL_NEON_DEPLOYMENT.md`.

## Ключевая бизнес-логика

У товара есть пять статусов:

| Статус | Значение | Поведение |
| --- | --- | --- |
| `IN_STOCK` | Есть запас | Рассчитать следующую проверку |
| `LOW` | Осталось мало | Назначить повторную проверку через 3 дня |
| `NEED_BUY` | Нужно купить | Добавить в список покупок |
| `URGENT` | Срочно купить | Добавить в начало списка покупок |
| `PAUSED` | Не отслеживать | Не показывать в ближайших проверках |

Backend является источником истины для переходов статусов, расчета `nextCheckAt` и синхронизации списка покупок. Frontend может использовать optimistic update, но не должен дублировать бизнес-правила.

## Web Auth And Optional Telegram

Целевой production MVP использует browser auth: Google sign-in как основной
способ входа, email magic link как доступный, но не приоритетный fallback и
Apple sign-in как реализованный provider flow, готовый к provider setup/smoke.
Backend обязан создавать пользователя и bearer/browser session только после
проверенного auth exchange: одноразового magic link токена, OAuth state/code
callback или другого явно включенного provider boundary. Идентификатор
пользователя берется только из проверенного авторизационного контекста.

Telegram Mini App остается optional integration. Если она включена, backend
проверяет подлинность Telegram WebApp `initData`; Telegram user id не должен
использоваться как единственный обязательный идентификатор продукта.

Нельзя:

- доверять `userId` из body или query-параметров;
- включать локальную авторизацию в production;
- логировать magic link токены, bot token, `initData`, JWT или приватные заметки;
- передавать содержимое пользовательских товаров сторонним LLM без отдельного согласия.

In-app reminders отображаются внутри webapp: на главной, в настройках и на
экранах категорий/товаров. Внешние Telegram/email/push reminders не входят в
бесплатный web-first MVP.

## Тестирование

Перед завершением задачи необходимо выполнить:

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm test:e2e
pnpm test:integration
```

Минимальный E2E-сценарий MVP покрыт в
`tests/e2e/web-first-product-flow.spec.ts` (входит в `pnpm test:e2e`):

1. Открыть приложение.
2. Создать категорию.
3. Добавить товар.
4. Изменить статус на `NEED_BUY`.
5. Убедиться, что товар появился в списке покупок.
6. Отметить товар купленным.
7. Убедиться, что статус изменился на `IN_STOCK`.

## Принципы разработки

- использовать TypeScript и явные типы;
- хранить общую бизнес-логику в `packages/shared`;
- изолировать данные каждого пользователя по `userId`;
- делать интерфейс mobile-first;
- не добавлять production-зависимости без необходимости;
- сопровождать нетривиальную бизнес-логику тестами;
- обновлять документацию при изменении API, модели данных или пользовательского сценария;
- не выполнять необратимые операции с данными без подтверждения.

## Приватность

Пользователь может хранить сведения о лекарствах, средствах гигиены и других чувствительных товарах. Такие данные считаются приватными по умолчанию.

MVP должен поддерживать:

- удаление аккаунта и связанных данных;
- экспорт пользовательских данных;
- строгую изоляцию данных пользователей;
- минимально необходимые логи;
- отсутствие передачи данных сторонним AI- и аналитическим сервисам без согласия пользователя.

## Collaboration beta

Совместные списки реализованы как beta-функция. Текущая модель шарит весь
активный список/workspace, а не отдельный набор товаров. Владелец может
пригласить участника по email, отозвать ожидающее приглашение, удалить доступ
и передать владение.

Slice 32 из `docs/IMPLEMENTATION_ROADMAP.md` закрыт: точка входа
“Поделиться списком” доступна владельцу на вкладке “Категории” и в настройках,
добавлены API-тесты на граничные случаи приглашений, а двухаккаунтный сценарий
покрыт браузерным E2E (`tests/e2e/workspace-collaboration.spec.ts`). Перед
широким включением рекомендуется вручную прогнать полный сценарий sharing на
реальном деплое (staging/production) с реальными email-адресами: приглашение,
вход по ссылке из письма, совместное редактирование, удаление доступа и передача
владения. Manual checklist находится в `docs/IMPLEMENTATION_ROADMAP.md`.

## Готовность MVP

Web-first MVP считается готовым к release-readiness проходу, когда пользователь
может открыть приложение в мобильном браузере, войти через email magic link,
создать категории и товары, менять их статусы, получать автоматически
сформированный список покупок, видеть in-app reminders по ближайшим проверкам,
проходить проверку категории или набора и экспортировать свои данные.

Полное соответствие продукту требует закрыть расхождения из раздела
`Оставшиеся расхождения с PRODUCT_SPEC`. Подробные критерии приемки находятся в
`docs/PRODUCT_SPEC.md`.
