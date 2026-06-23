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
- экспорт пользовательских данных в JSON.

## Текущий web-first MVP scope

- email magic link авторизация реализована;
- Google sign-in реализован и проверен в production;
- Apple sign-in реализован на уровне приложения и готов к provider setup/smoke;
- browser session использует bearer/JWT после magic link verify;
- home/settings UI для in-app reminders реализован;
- настройка `usageCycleDays`, `nextCheckAt` и `reminderEnabled` в UI
  реализована для товаров, категорий и наборов;
- continued browser smoke на deployed HTTPS URL без Telegram credentials;
- Telegram auth/bot/reminder delivery оставить выключаемой optional integration.

## Оставшиеся расхождения с PRODUCT_SPEC

`docs/PRODUCT_SPEC.md` остается источником полного продуктового и технического
задания. После web-first pivot реализованное ядро MVP пока не закрывает:

- direct actions из in-app reminder row: изменение статуса, старт проверки или
  snooze без перехода в связанную сущность;
- продолжение незавершенной check session после перезагрузки webapp;
- rate limiting для auth и чувствительных endpoints;
- удаление и изменение порядка категорий/товаров там, где ТЗ требует отдельный
  delete/reorder contract, а текущий MVP использует архивирование;
- действие рекомендаций `Скрыть похожие`;
- полноценные e2e и DB-backed integration tests;
- optional Telegram integration smoke, если позже появится платный bot/worker
  deployment или другой бесплатный способ постоянного запуска.

## Вне MVP

В первую версию не входят:

- интеграции с магазинами;
- мониторинг цен и скидок;
- сканирование чеков и штрих-кодов;
- AI- или ML-рекомендатель;
- семейные аккаунты и совместные списки;
- подписки и платежи;
- нативные приложения для iOS и Android;
- сложная аналитика расходов.

## Документация

- `docs/PRODUCT_SPEC.md` - продуктовое и техническое задание;
- `docs/API.md` - описание API;
- `docs/ARCHITECTURE.md` - архитектурные решения;
- `docs/FINAL_INTEGRATION.md` - финальный MVP integration checklist;
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
- Vitest.

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
    FINAL_INTEGRATION.md
  docker-compose.yml
  pnpm-workspace.yaml
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
pnpm dev             # Запуск всех сервисов в режиме разработки
pnpm build           # Production-сборка
pnpm typecheck       # Проверка типов
pnpm lint            # Статический анализ
pnpm test            # Unit- и integration-тесты
pnpm smoke:deployment # Smoke deployed API/webapp через HTTPS

pnpm db:generate     # Генерация Prisma Client
pnpm db:migrate      # Применение локальных миграций
pnpm db:deploy       # Применение production migrations
pnpm db:seed         # Добавление стартовых данных
```

`pnpm test:e2e` и Playwright-сценарии пока не настроены в workspace. Этот gap
зафиксирован в roadmap как часть финальной интеграции и не должен трактоваться
как выполненное соответствие полному `PRODUCT_SPEC.md`.

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

Google sign-in is production-enabled for the web-first MVP. While the Google
Auth Platform publishing status is `Testing`, each tester's Google account must
be added to Test users before they can complete OAuth.

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

Целевой production MVP использует email magic link авторизацию. Backend обязан
создавать пользователя и bearer/browser session только после проверки
одноразового magic link токена. Идентификатор пользователя берется только из
проверенного авторизационного контекста.

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
```

Минимальный E2E-сценарий MVP для будущего `test:e2e` setup:

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

## Готовность MVP

Web-first MVP считается готовым к release-readiness проходу, когда пользователь
может открыть приложение в мобильном браузере, войти через email magic link,
создать категории и товары, менять их статусы, получать автоматически
сформированный список покупок, видеть in-app reminders по ближайшим проверкам,
проходить проверку категории или набора и экспортировать свои данные.

Полное соответствие продукту требует закрыть расхождения из раздела
`Оставшиеся расхождения с PRODUCT_SPEC`. Подробные критерии приемки находятся в
`docs/PRODUCT_SPEC.md`.
