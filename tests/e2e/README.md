# E2E-тесты (Playwright)

Прогоняются через `pnpm test:e2e`. Требуют локальную PostgreSQL с применёнными
миграциями (см. `docker-compose.yml` и README корня репозитория).

## Структура

- `helpers.ts` — общие хелперы: `waitForApiHealth`, `apiBaseUrl`,
  `finishOnboardingIfNeeded` (стандартный путь онбординга, создаёт стартовые
  категории) и `skipOnboardingIfNeeded` (полностью пропускает онбординг,
  используется в visual-спеках с собственным сидингом данных).
- `legal-consent.ts` — сидинг юридического согласия.
- `*-visual.spec.ts` — визуальная регрессия (`toHaveScreenshot`). Снапшоты
  платформозависимые: для CI (linux) хранятся `*-linux.png`.

## Обновление visual-снапшотов

Снапшоты меняются только осознанно — при реальном изменении UI. Перед
коммитом обновите обе платформы:

- darwin (локально): `pnpm exec playwright test tests/e2e/categories-visual.spec.ts tests/e2e/screens-visual.spec.ts --update-snapshots`
- linux (CI-окружение): `./scripts/update-linux-snapshots.sh`

Маски, передаваемые в `toHaveScreenshot` (например, дата «Проверено …»),
запекаются в baseline при генерации — маску и снапшот нужно менять в одном
коммите.

## Отладка падений

- Трейсы пишутся только при падении (`trace: "retain-on-failure"`):
  `pnpm exec playwright show-report` или просмотр `test-results/**/*.zip`.
- Таймауты обычно означают медленный API/БД в CI, а не баг теста — смотрите
  артефакты job'ы `Playwright E2E tests` (загружаются на GitHub при падении).

## Чего не делать

- Не повышать `maxDiffPixels` и не добавлять фиксированные `waitForTimeout`
  «чтобы прошло» — сначала разберитесь в причине diff/таймаута.
- Не обновлять снапшоты, чтобы замаскировать нестабильное состояние UI.
