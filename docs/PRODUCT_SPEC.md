# Техническое задание

## Сервис персонального учета расходуемых товаров и бытовых запасов

## 1. Название проекта

Рабочее название: **kupitnezabyt**.

## 2. Краткое описание

`kupitnezabyt` помогает пользователю учитывать регулярно расходуемые товары: продукты, лекарства, косметику, бытовую химию, товары для дома, одежду, товары для питомцев, автомобиля, хобби и другие повторяющиеся покупки.

Продукт не является обычным разовым списком покупок. Он хранит персональные категории и регулярно восполняемые товары, позволяет отмечать состояние запасов, напоминает о проверках и формирует список покупок.

Пример:

1. Пользователь добавляет кофе, рис, шампунь и ибупрофен.
2. Для каждого товара выбирает статус: есть, мало, купить или срочно.
3. Товары со статусами `NEED_BUY` и `URGENT` автоматически попадают в список покупок.
4. Сервис напоминает проверить запас через заданный период.
5. Rule-based механизм может предложить связанные товары, но добавляет их только после подтверждения пользователя.

## 3. Цель MVP

Создать mobile-first web app с email magic link авторизацией и in-app
reminders, в котором пользователь может:

1. Авторизоваться через email magic link.
2. Создавать персональные категории.
3. Добавлять регулярно покупаемые товары.
4. Изменять состояние товара одним нажатием.
5. Назначать периодические проверки.
6. Видеть in-app reminders о товарах, категориях и наборах, которые пора
   проверить.
7. Автоматически формировать список покупок.
8. Создавать наборы связанных товаров.
9. Проходить пошаговую проверку категории или набора.
10. Получать базовые rule-based рекомендации.
11. Искать товары.
12. Экспортировать свои данные в JSON.

Telegram Mini App, Telegram Bot-команды и внешняя доставка Telegram reminders
не входят в бесплатный web-first MVP. Они остаются optional integration после
MVP, если появится подходящая инфраструктура для постоянного bot/worker
процесса.

## 4. Платформы

### 4.1. Основной интерфейс

Основная платформа MVP: **mobile web app в обычном браузере**.

Интерфейс открывается по HTTPS URL, оптимизирован под мобильный экран и может
быть добавлен на домашний экран телефона как browser/PWA-like experience.
Полный offline-first PWA не обязателен для MVP.

### 4.2. Email auth

Основной способ входа: email magic link. Пользователь вводит email, получает
одноразовую ссылку, открывает ее в браузере и получает authenticated session.

### 4.3. Optional Telegram integration

Telegram Bot может быть добавлен после MVP и использоваться для:

- запуска Mini App;
- отправки внешних напоминаний;
- быстрых действий с товарами;
- просмотра краткого списка покупок;
- переноса напоминаний.

Команды optional integration:

```text
/start
/app
/shopping
/check
/settings
/help
```

## 5. Целевая аудитория

Основной пользователь регулярно покупает одни и те же товары и не хочет хранить информацию об остатках в памяти, заметках и нескольких несвязанных списках.

Основные проблемы:

- повторяющиеся покупки распределены по разным областям жизни;
- сложно помнить, что заканчивается;
- обычные списки быстро устаревают;
- пользователь вспоминает о нужном товаре слишком поздно;
- нет простого сценария периодической проверки запасов.

Примеры категорий:

- Еда;
- Аптека;
- Косметика;
- Бытовая химия;
- Дом;
- Одежда;
- Питомцы;
- Авто;
- Хобби;
- Другое.

## 6. Ключевая продуктовая идея

Главная сущность сервиса - не разовая покупка, а **регулярно восполняемый товар**.

Обычный список покупок отвечает на вопрос:

> Что купить сейчас?

`kupitnezabyt` отвечает на вопросы:

> Что у меня обычно заканчивается?

> Что нужно проверить?

> Что уже пора купить?

## 7. Функциональные требования

### 7.1. Авторизация

1. Пользователь вводит email в webapp.
2. Backend создает одноразовый magic link token с коротким TTL.
3. Backend отправляет magic link на email пользователя через настроенный email
   provider.
4. Пользователь открывает magic link в браузере.
5. Backend проверяет токен, срок действия, одноразовость и создает
   authenticated session.
6. Для каждого email создается отдельный пользователь.
7. Все запросы выполняются в контексте авторизованного пользователя.
8. `userId` из request body или query parameters не используется как источник истины.
9. Данные одного пользователя недоступны другому.
10. Локальный режим авторизации разрешен только в development-окружении.
11. Telegram auth через WebApp `initData` допускается только как optional
    integration и не является обязательным MVP flow.

Минимальные данные пользователя:

```text
id
email
email_verified_at
display_name
language
timezone
created_at
updated_at
```

### 7.2. Онбординг

При первом запуске пользователь проходит короткий онбординг.

#### Экран 1. Приветствие

```text
kupitnezabyt помогает помнить о товарах, которые регулярно заканчиваются:
еда, аптека, косметика, дом и другое.
```

Кнопка: `Начать`.

#### Экран 2. Стартовые категории

Пользователь выбирает категории из шаблонов или пропускает шаг.

Кнопки:

```text
Продолжить
Пропустить
```

#### Экран 3. Первые товары

Пользователь может добавить 3-5 товаров вручную и явно выбрать категорию для
каждого товара. Если выбранной категории еще нет, она создается вместе со
стартовыми данными.

Примеры подсказок:

```text
Кофе
Ибупрофен
Шампунь
Стиральный порошок
Рис
```

#### Экран 4. Уведомления

```text
Я буду показывать напоминания внутри приложения, когда пора проверить запасы.
```

Подтверждение не является системным разрешением на push-уведомления. В
бесплатном MVP напоминания отображаются внутри webapp при открытии приложения.

### 7.3. Категории

Пользователь может:

1. Просматривать категории.
2. Создавать категорию.
3. Редактировать название и иконку.
4. Менять порядок категорий.
5. Архивировать или удалять категорию.
6. Видеть количество активных товаров.
7. Видеть агрегированный статус.
8. Запускать проверку категории.

Агрегированный статус:

```text
OK
ATTENTION
NEED_BUY
URGENT
```

Правила:

1. Если есть хотя бы один товар `URGENT`, категория получает `URGENT`.
2. Иначе, если есть `NEED_BUY`, категория получает `NEED_BUY`.
3. Иначе, если есть `LOW`, категория получает `ATTENTION`.
4. Иначе категория получает `OK`.
5. Архивные и приостановленные товары не участвуют в расчете.

Удаление непустой категории должно требовать подтверждения. По умолчанию предпочтительно архивирование.

### 7.4. Товары

Товар - регулярно расходуемая вещь, которую пользователь хочет отслеживать.

Основные поля:

```text
id
user_id
category_id
name
brand
notes
status
importance
usage_cycle_days
last_checked_at
last_bought_at
next_check_at
reminder_enabled
created_at
updated_at
archived_at
```

Статусы:

```text
IN_STOCK
LOW
NEED_BUY
URGENT
PAUSED
```

Важность:

```text
LOW
NORMAL
HIGH
CRITICAL
```

Пользователь может:

1. Добавить товар.
2. Отредактировать товар.
3. Изменить статус одним нажатием.
4. Перенести товар в другую категорию.
5. Настроить период проверки.
6. Включить или выключить напоминания.
7. Архивировать товар.
8. Удалить товар после подтверждения.

### 7.5. Быстрое изменение статуса

На карточке товара доступны кнопки:

```text
Есть
Мало
Купить
Срочно
```

При изменении статуса backend:

1. Обновляет `status`.
2. Обновляет `lastCheckedAt`.
3. Рассчитывает `nextCheckAt`.
4. Синхронизирует связанный элемент списка покупок.
5. Возвращает актуальное состояние товара.

Frontend может применять optimistic update, но backend остается источником истины.

### 7.6. Периодические проверки

Период задается целым количеством дней в `usageCycleDays`.

Примеры:

```text
Кофе - каждые 21 день
Шампунь - каждые 45 дней
Прокладки - каждые 28 дней
Стиральный порошок - каждые 60 дней
```

Напоминания поддерживаются:

1. Для отдельного товара.
2. Для категории.
3. Для пользовательского набора.

Все даты хранятся в UTC. Время отправки рассчитывается с учетом `User.timezone`.

### 7.7. Список покупок

Список автоматически включает активные товары со статусами:

```text
NEED_BUY
URGENT
```

Требования:

1. Срочные позиции отображаются первыми.
2. Позиции группируются по категориям.
3. Для одного отслеживаемого товара может существовать не более одной незавершенной позиции.
4. Повторное изменение статуса обновляет существующую позицию, а не создает дубль.
5. Пользователь может отметить товар купленным.
6. Пользователь может вручную добавить разовую позицию без создания отслеживаемого товара.
7. Завершенные позиции можно скрыть или очистить.

При отметке отслеживаемого товара купленным:

```text
Item.status = IN_STOCK
Item.lastBoughtAt = now
Item.lastCheckedAt = now
ShoppingListItem.isCompleted = true
ShoppingListItem.completedAt = now
Item.nextCheckAt = calculateNextCheckAt(...)
```

Для ручной позиции без `itemId` изменяется только состояние `ShoppingListItem`.

### 7.8. Рекомендации связанных товаров

В MVP используется rule-based механизм без LLM и ML.

Примеры правил:

```text
Лосось + рис -> нори, соевый соус, васаби
Прокладки -> обезболивающее, магний, грелка
Стиральный порошок -> кондиционер, пятновыводитель
Кофе -> фильтры, молоко, овсяное молоко
Зубная паста -> зубная щетка, нить, ополаскиватель
Шампунь -> кондиционер, маска для волос
Батарейки -> аккумуляторы, зарядное устройство
```

Поведение:

1. Названия нормализуются: lowercase, trim, удаление повторных пробелов.
2. Проверяются `triggerTerms` и при необходимости `requiredTerms`.
3. Уже существующие товары не предлагаются.
4. Ранее отклоненные рекомендации не предлагаются повторно.
5. За один запрос возвращается не более пяти предложений.
6. Рекомендации никогда не добавляются без подтверждения.
7. В интерфейсе рекомендации показываются только внутри категории исходного
   товара, для которого они были рассчитаны.

Действия:

```text
Добавить
Не нужно
Скрыть похожие
```

### 7.9. Пользовательские наборы

Набор объединяет товары, которые удобно проверять вместе.

Примеры:

```text
Суши дома
Аптечка
Цикл
Стирка
```

Пользователь может:

1. Создать набор.
2. Изменить название и иконку.
3. Добавить или удалить товары.
4. Настроить период проверки.
5. Запустить проверку набора.
6. Архивировать набор.

Один товар может входить в несколько наборов.

### 7.10. Режим проверки

Проверка - пошаговая сессия обновления статусов товаров категории или набора.

Сценарий:

1. Пользователь запускает проверку.
2. Сервис фиксирует список активных товаров на момент старта.
3. На экране показывается одна карточка.
4. Пользователь выбирает `Есть`, `Мало`, `Купить` или `Срочно`.
5. Статус сохраняется через общую backend-логику переходов.
6. После последнего товара сессия завершается.
7. Показывается количество проверенных, обычных и срочных покупок.

Незавершенную сессию можно продолжить. Архивные и `PAUSED` товары не включаются.

### 7.11. Напоминания

Канал MVP: in-app reminders внутри webapp.

Типы:

```text
ITEM_CHECK
CATEGORY_CHECK
GROUP_CHECK
SHOPPING_REMINDER
```

Примеры in-app карточек/строк:

```text
Проверь, не заканчивается ли кофе.
Пора проверить аптечку.
У тебя 4 товара в списке покупок. Срочно: ибупрофен.
```

Кнопки товарного in-app reminder:

```text
Есть
Мало
Купить
Срочно
Позже
Открыть
```

Кнопки reminder категории или набора:

```text
Начать проверку
Позже
Открыть
```

Варианты переноса:

```text
Через 1 день
Через 3 дня
Через неделю
```

Все действия reminder должны быть идемпотентными и использовать ту же
backend-логику, что и карточки товара в webapp.

Внешняя доставка через Telegram Bot API, email reminders или push notifications
не входит в бесплатный web-first MVP. Эти каналы могут быть добавлены позже
поверх той же модели `Reminder`.

### 7.12. Поиск

Поиск выполняется только по данным текущего пользователя:

- название;
- бренд;
- категория;
- заметки.

Для MVP допустим регистронезависимый поиск по подстроке.

### 7.13. Импорт, экспорт и удаление аккаунта

MVP:

1. Экспорт всех пользовательских данных в JSON.
2. Удаление аккаунта и связанных данных после явного подтверждения.
3. Удаление не должно оставлять доступные из приложения персональные записи.

После MVP:

- экспорт CSV;
- импорт CSV;
- импорт из заметок;
- импорт из Telegram-сообщения;
- импорт из фото чека;
- импорт истории покупок при наличии легального источника.

## 8. Нефункциональные требования

### 8.1. Производительность

1. Основной экран загружается менее чем за 2 секунды при нормальном соединении.
2. Изменение статуса визуально применяется мгновенно.
3. Целевое время ответа основных API-запросов - менее 500 мс при обычной нагрузке MVP, без учета внешних email-provider запросов.

### 8.2. Надежность

1. Ошибка отправки magic link email не должна создавать authenticated session.
2. Magic link токены одноразовые и имеют короткий срок действия.
3. In-app reminders не требуют постоянно запущенного worker процесса.
4. Действия с reminders идемпотентны.
5. Для одного объекта и расчетного периода не создаются дубли reminder-записей.

### 8.3. Безопасность

1. Magic link токены проверяются только на backend.
2. Пользователь определяется из авторизационного контекста.
3. Все запросы фильтруются по `userId`.
4. Секреты хранятся только в переменных окружения.
5. Magic link токены, email provider tokens, `initData`, JWT и чувствительные заметки не логируются.
6. Development authentication запрещена в production.
7. Валидация входных данных выполняется на границе API.
8. Rate limiting применяется к auth и чувствительным endpoints.

### 8.4. Приватность

Товары и заметки могут раскрывать сведения о здоровье, гигиене и личных привычках.

Требования:

1. Не использовать пользовательские данные для публичных рекомендаций.
2. Не передавать данные сторонним LLM или аналитическим сервисам без отдельного согласия.
3. Не показывать данные одного пользователя другому.
4. Поддерживать экспорт и удаление данных.
5. Собирать только необходимые технические логи.

### 8.5. Доступность

1. Интерактивные элементы должны иметь доступные названия.
2. Статус не должен передаваться только цветом.
3. Основные действия доступны с клавиатуры в браузере.
4. Размер touch target для основных мобильных действий - не менее 44 x 44 px.

## 9. UX/UI

### 9.1. Общий стиль

Интерфейс:

- mobile-first;
- быстрый и простой;
- похож на сочетание habit tracker и shopping list;
- не выглядит как складская или ERP-система;
- использует понятные мобильные контролы;
- поддерживает светлую и темную тему браузера/системы.

### 9.2. Навигация

Нижнее меню:

```text
Главная
Категории
Покупки
Проверка
Настройки
```

### 9.3. Главная

Показывает:

1. Общий индекс готовности.
2. Ближайшие проверки.
3. Срочные товары.
4. Быстрый доступ к категориям.
5. Кнопку добавления товара.

Формула MVP:

```text
readiness =
  items with status IN_STOCK /
  all active non-PAUSED items *
  100
```

Если активных товаров нет, индекс не рассчитывается; показывается onboarding empty state.

### 9.4. Экран категории

Содержит:

- название и агрегированный статус;
- список товаров;
- поиск или фильтр при необходимости;
- кнопку `Проверить категорию`;
- кнопку `Добавить товар`;
- empty, loading и error states.

### 9.5. Карточка товара

Содержит:

```text
Название
Бренд, если есть
Статус
Следующая проверка
Быстрые кнопки статуса
```

### 9.6. Список покупок

Показывает:

1. Срочные позиции.
2. Обычные позиции.
3. Группировку по категориям.
4. Ручные позиции.
5. Действие `Отметить купленным`.
6. Действие очистки завершенных позиций.

### 9.7. Проверка

На экране одновременно отображается одна карточка товара, прогресс сессии и четыре действия изменения статуса.

## 10. Архитектура

### 10.1. Принятый стек MVP

Frontend:

```text
Next.js
React
TypeScript
mobile-first CSS
```

Backend:

```text
Node.js
TypeScript
Fastify
Prisma ORM
PostgreSQL
```

Optional Telegram integration:

```text
grammY
Telegram Mini Apps SDK
```

Инструменты:

```text
pnpm workspaces
Docker Compose
Vitest
Playwright
ESLint
```

### 10.2. Сервисы

```text
webapp
api
postgres
```

`bot`, `worker` и `redis` остаются optional services для Telegram/external
reminder integration после MVP.

### 10.3. Ответственность сервисов

`apps/webapp`:

- UI;
- email magic link login flow;
- вызовы API;
- optimistic updates;
- in-app reminders.

`apps/api`:

- авторизация;
- валидация;
- бизнес-логика;
- CRUD;
- статусные переходы;
- экспорт и удаление аккаунта.

`apps/bot`:

- optional Telegram-команды;
- optional Telegram-уведомления;
- inline-кнопки;
- открытие Mini App.

`apps/worker`:

- optional внешняя доставка reminder-записей;
- отправка через Telegram Bot API;
- retries;
- защита от дублей.

`packages/shared`:

- общие типы;
- схемы валидации;
- чистая доменная логика;
- правила рекомендаций.

`packages/database`:

- Prisma schema;
- migrations;
- database client;
- seed.

## 11. Модель данных

Ниже приведена логическая модель. Окончательные Prisma-типы и индексы определяются при реализации.

### 11.1. User

```ts
User {
  id: string
  email: string
  emailVerifiedAt?: Date
  displayName?: string
  telegramUserId?: string
  telegramUsername?: string
  language: string
  timezone: string
  onboardingCompletedAt?: Date
  createdAt: Date
  updatedAt: Date
}
```

`email` уникален. `telegramUserId` уникален, если optional Telegram integration
подключена к аккаунту. `onboardingCompletedAt` хранит факт завершения первого
запуска на backend, чтобы пользователь не проходил onboarding повторно на новом
устройстве или после нового входа.

### 11.1.1. MagicLinkToken

```ts
MagicLinkToken {
  id: string
  email: string
  tokenHash: string
  expiresAt: Date
  consumedAt?: Date
  createdAt: Date
}
```

`tokenHash` хранится вместо raw token.

### 11.2. Category

```ts
Category {
  id: string
  userId: string
  name: string
  icon?: string
  sortOrder: number
  usageCycleDays?: number
  nextCheckAt?: Date
  reminderEnabled: boolean
  createdAt: Date
  updatedAt: Date
  archivedAt?: Date
}
```

### 11.3. Item

```ts
Item {
  id: string
  userId: string
  categoryId: string
  name: string
  brand?: string
  notes?: string
  status: ItemStatus
  importance: ItemImportance
  usageCycleDays?: number
  lastCheckedAt?: Date
  lastBoughtAt?: Date
  nextCheckAt?: Date
  reminderEnabled: boolean
  createdAt: Date
  updatedAt: Date
  archivedAt?: Date
}
```

```ts
enum ItemStatus {
  IN_STOCK
  LOW
  NEED_BUY
  URGENT
  PAUSED
}

enum ItemImportance {
  LOW
  NORMAL
  HIGH
  CRITICAL
}
```

### 11.4. ItemGroup

```ts
ItemGroup {
  id: string
  userId: string
  name: string
  icon?: string
  usageCycleDays?: number
  nextCheckAt?: Date
  reminderEnabled: boolean
  createdAt: Date
  updatedAt: Date
  archivedAt?: Date
}
```

### 11.5. ItemGroupItem

```ts
ItemGroupItem {
  id: string
  groupId: string
  itemId: string
  createdAt: Date
}
```

Пара `(groupId, itemId)` уникальна.

### 11.6. ShoppingListItem

```ts
ShoppingListItem {
  id: string
  userId: string
  itemId?: string
  title: string
  categoryId?: string
  priority: ShoppingPriority
  isCompleted: boolean
  completedAt?: Date
  createdAt: Date
  updatedAt: Date
}

enum ShoppingPriority {
  NORMAL
  URGENT
}
```

Для одного `itemId` допускается не более одной незавершенной позиции.

### 11.7. Reminder

```ts
Reminder {
  id: string
  userId: string
  type: ReminderType
  itemId?: string
  categoryId?: string
  groupId?: string
  scheduledFor: Date
  status: ReminderStatus
  attemptCount: number
  sentAt?: Date
  createdAt: Date
  updatedAt: Date
}

enum ReminderType {
  ITEM_CHECK
  CATEGORY_CHECK
  GROUP_CHECK
  SHOPPING_REMINDER
}

enum ReminderStatus {
  PENDING
  SENT
  FAILED
  CANCELLED
}
```

### 11.8. RecommendationRule

```ts
RecommendationRule {
  id: string
  triggerTerms: string[]
  requiredTerms?: string[]
  suggestedItems: string[]
  categoryHint?: string
}
```

Правила MVP могут храниться в коде или seed-данных.

### 11.9. RecommendationDismissal

```ts
RecommendationDismissal {
  id: string
  userId: string
  ruleId: string
  suggestedItem: string
  createdAt: Date
}
```

Сущность хранит отклоненные пользователем предложения.

### 11.10. CheckSession

```ts
CheckSession {
  id: string
  userId: string
  categoryId?: string
  groupId?: string
  status: CheckSessionStatus
  startedAt: Date
  completedAt?: Date
}

enum CheckSessionStatus {
  IN_PROGRESS
  COMPLETED
  CANCELLED
}
```

Ровно одно из полей `categoryId` и `groupId` должно быть заполнено.

### 11.11. CheckSessionItem

```ts
CheckSessionItem {
  id: string
  sessionId: string
  itemId: string
  sortOrder: number
  selectedStatus?: ItemStatus
  checkedAt?: Date
}
```

Снимок состава сессии позволяет корректно продолжить проверку позднее.

## 12. API

Все endpoints, кроме health check и auth exchange, требуют авторизации.

### 12.1. Auth и пользователь

```http
POST /api/auth/telegram
POST /api/auth/email/request
POST /api/auth/email/verify
GET  /api/me
DELETE /api/me
GET  /api/export/json
```

`POST /api/auth/telegram` относится к optional Telegram integration.

### 12.2. Categories

```http
GET    /api/categories
POST   /api/categories
GET    /api/categories/:id
PATCH  /api/categories/:id
DELETE /api/categories/:id
POST   /api/categories/:id/archive
```

### 12.3. Items

```http
GET    /api/items
POST   /api/items
GET    /api/items/:id
PATCH  /api/items/:id
DELETE /api/items/:id
POST   /api/items/:id/status
POST   /api/items/:id/mark-bought
POST   /api/items/:id/snooze
POST   /api/items/:id/archive
```

### 12.4. Shopping list

```http
GET    /api/shopping-list
POST   /api/shopping-list
PATCH  /api/shopping-list/:id
POST   /api/shopping-list/:id/complete
DELETE /api/shopping-list/:id
DELETE /api/shopping-list/completed
```

### 12.5. Groups

```http
GET    /api/groups
POST   /api/groups
GET    /api/groups/:id
PATCH  /api/groups/:id
DELETE /api/groups/:id
POST   /api/groups/:id/items
DELETE /api/groups/:id/items/:itemId
```

### 12.6. Check sessions

```http
POST /api/check/category/:categoryId/start
POST /api/check/group/:groupId/start
GET  /api/check/session/:sessionId
POST /api/check/session/:sessionId/item/:itemId/status
POST /api/check/session/:sessionId/complete
POST /api/check/session/:sessionId/cancel
```

### 12.7. Recommendations

```http
GET  /api/recommendations?itemId=...
POST /api/recommendations/:id/accept
POST /api/recommendations/:id/dismiss
POST /api/recommendations/:id/hide-similar
```

### 12.8. Service

```http
GET /health
```

Подробные request/response schemas оформляются в `docs/API.md` по мере реализации.

## 13. Бизнес-логика

### 13.1. Расчет следующей проверки

При `IN_STOCK`:

```ts
nextCheckAt = usageCycleDays
  ? now + usageCycleDays
  : null
```

При `LOW`:

```ts
nextCheckAt = now + 3 days
```

При `NEED_BUY`, `URGENT` или `PAUSED`:

```ts
nextCheckAt = null
```

После завершения проверки категории или набора:

```ts
nextCheckAt = usageCycleDays
  ? now + usageCycleDays
  : null
```

### 13.2. Синхронизация списка покупок

1. `NEED_BUY` создает или обновляет позицию с `NORMAL`.
2. `URGENT` создает или обновляет позицию с `URGENT`.
3. Переход между `NEED_BUY` и `URGENT` обновляет приоритет.
4. Повторный запрос не создает дубль.
5. `mark-bought` завершает позицию и переводит товар в `IN_STOCK`.
6. При ручном переводе из `NEED_BUY` или `URGENT` в `IN_STOCK`, соответствующая незавершенная позиция также завершается.

Операция обновления товара и списка покупок выполняется транзакционно.

### 13.3. Агрегирование категории

Приоритет:

```text
URGENT > NEED_BUY > LOW > IN_STOCK
```

`PAUSED` и архивные товары игнорируются.

### 13.4. Напоминания

В web-first MVP reminders отображаются при открытии приложения и запросе
пользовательских данных. Backend/API:

1. Выбирает due-объекты.
2. Создает запись `Reminder` с идемпотентным ключом.
3. Возвращает due/upcoming reminders в API response.
4. Не создает дубли для одного объекта и расчетного периода.
5. Позволяет пользователю выполнить действие: изменить статус, начать проверку
   или перенести reminder.

Optional Telegram/email/push delivery может использовать отдельный worker после
MVP.

### 13.5. Временные зоны

1. Все даты в базе хранятся в UTC.
2. Пользовательские настройки интерпретируются в `User.timezone`.
3. Переходы на летнее и зимнее время обрабатываются библиотекой работы с IANA time zones.

## 14. Структура репозитория

```text
/
  apps/
    webapp/
    api/
    bot/
    worker/
  packages/
    database/
    shared/
    ui/
  docs/
    PRODUCT_SPEC.md
    API.md
    ARCHITECTURE.md
  docker-compose.yml
  pnpm-workspace.yaml
  .env.example
  AGENTS.md
  README.md
```

Назначение документов:

- `README.md` - обзор проекта, локальный запуск и основные команды;
- `docs/PRODUCT_SPEC.md` - продуктовые и технические требования;
- `docs/API.md` - подробные API-контракты;
- `docs/ARCHITECTURE.md` - принятые архитектурные решения;
- `AGENTS.md` - отдельные инструкции для Codex и других coding agents.

Содержимое `AGENTS.md` не дублируется в техническом задании.

## 15. Переменные окружения

```env
DATABASE_URL=

JWT_SECRET=
APP_BASE_URL=
NEXT_PUBLIC_API_BASE_URL=
NODE_ENV=

EMAIL_FROM=
EMAIL_PROVIDER_API_KEY=
MAGIC_LINK_TOKEN_TTL_MINUTES=15

DEV_AUTH_ENABLED=false

# Optional Telegram integration
TELEGRAM_BOT_TOKEN=
TELEGRAM_BOT_USERNAME=
TELEGRAM_WEBAPP_URL=
```

`DEV_AUTH_ENABLED=true` допустимо только при `NODE_ENV=development`.

## 16. Тестирование

### 16.1. Unit tests

Покрыть:

1. Расчет `nextCheckAt`.
2. Переходы статусов.
3. Синхронизацию списка покупок.
4. Защиту от дублей.
5. `mark-bought`.
6. Rule-based рекомендации.
7. Отклонение рекомендаций.
8. Агрегирование категории.
9. Расчет due reminders.
10. Magic link token hashing, expiry and one-time consumption.

### 16.2. Integration tests

Покрыть:

1. Email magic link request/verify flow.
2. Изоляцию данных по `userId`.
3. CRUD категорий и товаров.
4. Shopping list flow.
5. Reminder creation и duplicate prevention.
6. In-app reminder actions.
7. Check session flow.
8. Экспорт и удаление аккаунта.

### 16.3. E2E tests

Минимальные сценарии:

1. Первый вход через email magic link.
2. Создание категории.
3. Добавление товара.
4. Изменение статуса на `NEED_BUY`.
5. Появление товара в списке покупок.
6. Отметка товара купленным.
7. Проверка перехода в `IN_STOCK`.
8. Прохождение проверки категории.

### 16.4. Команды проверки

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm test:e2e
```

## 17. Acceptance criteria MVP

MVP готов, если:

1. Webapp открывается в мобильном браузере по HTTPS URL.
2. Email magic link auth работает в production-like окружении.
3. Пользователь может создавать и редактировать категории.
4. Пользователь может создавать и редактировать товары.
5. Быстрое изменение статуса работает.
6. `NEED_BUY` и `URGENT` синхронизируются со списком покупок без дублей.
7. Пользователь может отметить товар купленным.
8. Пользователь может настроить период проверки.
9. In-app reminders показывают due/upcoming проверки без дублей.
10. Пользователь может создать набор.
11. Пользователь может пройти проверку категории или набора.
12. Сервис показывает rule-based рекомендации.
13. Пользователь может искать товары.
14. Пользователь может экспортировать данные.
15. Пользователь может удалить аккаунт.
16. Данные сохраняются в PostgreSQL.
17. Проект запускается по инструкции из README.
18. Ключевая бизнес-логика покрыта тестами.
19. Typecheck, lint и test suite проходят успешно.

## 18. Что не входит в MVP

1. Сканирование чеков.
2. Сканирование штрих-кодов.
3. Интеграции с магазинами.
4. Мониторинг цен и скидок.
5. LLM- или ML-рекомендатель.
6. Семейные аккаунты.
7. Совместные списки.
8. Нативные приложения iOS и Android.
9. Оплата и подписки.
10. Сложная аналитика расходов.
11. Полный offline-first PWA.
12. Telegram Bot как обязательный канал.
13. Внешние Telegram/email/push reminders.

## 19. Backlog после MVP

### 19.1. AI-рекомендации

LLM-слой может предлагать связанные товары на основе пользовательских паттернов только после отдельного согласия на передачу данных.

### 19.2. Предиктивные циклы

Сервис оценивает фактическую периодичность:

```text
Кофе обычно заканчивается раз в 19-23 дня.
```

### 19.3. Сезонные товары

Примеры:

```text
Солнцезащитный крем - весна/лето
Витамин D - осень/зима
Средство от комаров - лето
Термобелье - зима
```

### 19.4. Интеграции с магазинами

Мониторинг цен и скидок для отслеживаемых товаров при наличии легального источника данных.

### 19.5. Семейный режим

Несколько пользователей ведут общие категории и списки.

### 19.6. Фото-проверка

Пользователь фотографирует полку, аптечку или ванную, а сервис помогает определить, что заканчивается.

### 19.7. Telegram integration

Telegram Mini App, Bot-команды, Telegram reminder delivery и callback-кнопки
могут быть возвращены как optional integration после web-first MVP.

## 20. Принятые решения для MVP

1. Package manager: `pnpm`.
2. Backend framework: Fastify.
3. Production auth MVP: email magic links.
4. Database: PostgreSQL через Prisma.
5. Queue/worker: не требуется для бесплатного web-first MVP.
6. Первый язык интерфейса: русский.
7. Категории пользовательские, со стартовыми шаблонами.
8. Рекомендации только rule-based.
9. Цены и магазины не входят в MVP.
10. Семейный режим отложен.
11. Mobile web app является основным каналом.
12. Telegram Mini App и bot являются optional integration после MVP.
13. Лекарства, средства гигиены и заметки считаются чувствительными данными.
14. Инструкции для coding agents хранятся только в корневом `AGENTS.md`.
