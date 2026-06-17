# kupitnezabyt

`kupitnezabyt` - Telegram Mini App для учета регулярно расходуемых товаров и бытовых запасов.

Сервис помогает хранить персональные категории товаров, отмечать текущие запасы, вовремя проверять остатки и автоматически формировать список покупок. Это не обычный разовый список покупок, а инструмент для управления повторяющимися потребностями: продуктами, лекарствами, косметикой, бытовой химией, товарами для дома, питомцев, автомобиля и хобби.

## Статус проекта

Core MVP slices implemented: реализовано основное вертикальное ядро продукта из
`docs/IMPLEMENTATION_ROADMAP.md`, но это еще не означает полного соответствия
всем требованиям `docs/PRODUCT_SPEC.md`.

Текущий статус: приложение готово к hardening/finalization-проходу, локальной
интеграционной проверке и Telegram smoke с реальными credentials. Оставшиеся
расхождения с полным техническим заданием перечислены ниже и отслеживаются как
finalization/follow-up work, а не как новые базовые product slices.

Основной интерфейс запускается как Telegram Mini App. Часть Telegram-уведомлений
и быстрых действий доступна через Telegram-бота. Архитектура также должна
позволять использовать веб-интерфейс в обычном мобильном браузере.

## Реализованное ядро MVP

- авторизация через Telegram;
- пользовательские категории;
- добавление и редактирование регулярно покупаемых товаров;
- быстрые статусы `Есть`, `Мало`, `Купить`, `Срочно`;
- автоматическое формирование списка покупок;
- отметка товара как купленного;
- периодические проверки и `ITEM_CHECK` Telegram-напоминания для товаров;
- пошаговый режим проверки запасов;
- наборы связанных товаров;
- rule-based рекомендации;
- поиск по товарам;
- экспорт пользовательских данных в JSON.

## Оставшиеся расхождения с PRODUCT_SPEC

`docs/PRODUCT_SPEC.md` остается источником полного продуктового и технического
задания. Реализованное ядро MVP пока не закрывает полностью:

- Telegram reminder types `CATEGORY_CHECK`, `GROUP_CHECK` и
  `SHOPPING_REMINDER`;
- Telegram bot-команды `/shopping`, `/check`, `/settings`;
- пользовательскую настройку циклов проверки и включения/выключения
  напоминаний для товаров, категорий и наборов в UI;
- продолжение незавершенной check session после перезагрузки webapp;
- rate limiting для auth и чувствительных endpoints;
- удаление и изменение порядка категорий/товаров там, где ТЗ требует отдельный
  delete/reorder contract, а текущий MVP использует архивирование;
- действие рекомендаций `Скрыть похожие`;
- полноценные e2e и DB-backed integration tests.

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
- Telegram WebApp runtime API.

### Backend

- Node.js;
- TypeScript;
- Fastify;
- Prisma ORM;
- PostgreSQL.

### Bot и фоновые задачи

- grammY;
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
    webapp/             # Telegram Mini App и PWA-интерфейс
    api/                # Backend API
    bot/                # Telegram-бот
    worker/             # Планировщик напоминаний и фоновые задачи
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
- Docker с поддержкой Docker Compose;
- Telegram-бот, созданный через BotFather, для проверки реальной интеграции.

Для разработки интерфейса без Telegram должен быть предусмотрен локальный режим авторизации. Он разрешен только при `NODE_ENV=development`.

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

TELEGRAM_BOT_TOKEN=
TELEGRAM_BOT_USERNAME=
TELEGRAM_WEBAPP_URL=http://localhost:3000

JWT_SECRET=
APP_BASE_URL=http://localhost:3000
NEXT_PUBLIC_API_BASE_URL=http://localhost:3001
API_PORT=3001
NODE_ENV=development

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
- API health check: `http://localhost:3001/health`.

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

Telegram bot и worker вынесены в profile `telegram`, потому что требуют
реальный `TELEGRAM_BOT_TOKEN`, публичный `TELEGRAM_WEBAPP_URL` и доступ к
Telegram API:

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

pnpm db:generate     # Генерация Prisma Client
pnpm db:migrate      # Применение локальных миграций
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
| `REDIS_URL` | Подключение к Redis | Да |
| `TELEGRAM_BOT_TOKEN` | Токен Telegram-бота | Да, кроме локального UI-режима |
| `TELEGRAM_BOT_USERNAME` | Username Telegram-бота | Да, кроме локального UI-режима |
| `TELEGRAM_WEBAPP_URL` | Публичный URL Mini App | Да для Telegram |
| `JWT_SECRET` | Подпись серверной сессии | Да |
| `APP_BASE_URL` | Базовый URL приложения | Да |
| `NEXT_PUBLIC_API_BASE_URL` | URL API для webapp | Да для webapp |
| `API_PORT` | Порт API | Нет |
| `NODE_ENV` | Режим запуска | Да |
| `DEV_AUTH_ENABLED` | Локальная авторизация без Telegram | Только для разработки |

## Ключевая бизнес-логика

У товара есть пять статусов:

| Статус | Значение | Поведение |
| --- | --- | --- |
| `IN_STOCK` | Есть запас | Рассчитать следующую проверку |
| `LOW` | Осталось мало | Назначить повторную проверку через 3 дня |
| `NEED_BUY` | Нужно купить | Добавить в список покупок |
| `URGENT` | Срочно купить | Добавить в начало списка покупок |
| `PAUSED` | Не отслеживать | Не отправлять напоминания |

Backend является источником истины для переходов статусов, расчета `nextCheckAt` и синхронизации списка покупок. Frontend может использовать optimistic update, но не должен дублировать бизнес-правила.

## Telegram Mini App

В production backend обязан проверять подлинность Telegram WebApp `initData`. Идентификатор пользователя берется только из проверенного авторизационного контекста.

Нельзя:

- доверять `userId` из body или query-параметров;
- включать локальную авторизацию в production;
- логировать bot token, `initData`, JWT или приватные заметки;
- передавать содержимое пользовательских товаров сторонним LLM без отдельного согласия.

Для локальной проверки Telegram-интеграции понадобится публичный HTTPS URL. Его можно передать в `TELEGRAM_WEBAPP_URL` и настроить как Mini App URL у бота.

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

Текущий core MVP считается готовым к release-readiness проходу, когда
пользователь может открыть Mini App из Telegram, создать категории и товары,
менять их статусы, получать автоматически сформированный список покупок,
получать товарные `ITEM_CHECK` напоминания, проходить проверку категории или
набора и экспортировать свои данные.

Полное соответствие продукту требует закрыть расхождения из раздела
`Оставшиеся расхождения с PRODUCT_SPEC`. Подробные критерии приемки находятся в
`docs/PRODUCT_SPEC.md`.
