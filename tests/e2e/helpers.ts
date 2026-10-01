import type { APIRequestContext, Page } from "@playwright/test";

export const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? `http://localhost:${process.env.E2E_API_PORT ?? 3001}`;

export async function waitForApiHealth(request: APIRequestContext): Promise<void> {
  const deadline = Date.now() + 15_000;
  let lastStatus = 0;
  let lastBody = "";

  while (Date.now() < deadline) {
    const response = await request
      .get(`${apiBaseUrl}/health/detailed`, {
        timeout: 3_000
      })
      .catch(() => null);

    if (response?.status() === 200) {
      return;
    }

    lastStatus = response?.status() ?? 0;
    lastBody = response ? await response.text() : "API request failed";
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(
    `E2E requires a migrated PostgreSQL database reachable by the API. ` +
      `Run the local database and migrations before pnpm test:e2e. ` +
      `Last /health/detailed response: ${lastStatus} ${lastBody}`
  );
}

// Проходит онбординг стандартным путём: подтверждает стартовые категории
// (включая «Еда») и пропускает добавление стартовых товаров.
export async function finishOnboardingIfNeeded(page: Page): Promise<void> {
  const startButton = page.getByRole("button", { name: "Начать" });
  // locator.isVisible() does not wait, so use waitFor to survive cold dev compiles.
  const isOnboardingVisible = await startButton
    .waitFor({ state: "visible", timeout: 30_000 })
    .then(() => true)
    .catch(() => false);
  if (!isOnboardingVisible) {
    return;
  }

  await startButton.click();
  await page.getByRole("button", { name: "Продолжить" }).click();
  await page.getByRole("button", { name: "Пропустить" }).click();
  await page.getByRole("button", { name: "Готово" }).click();
}

// Проходит онбординг, полностью пропуская создание стартовых данных,
// чтобы не засорять БД (используется в visual-спеках с собственным сидингом).
export async function skipOnboardingIfNeeded(page: Page): Promise<void> {
  const startButton = page.getByRole("button", { name: "Начать" });
  const isOnboardingVisible = await startButton
    .waitFor({ state: "visible", timeout: 30_000 })
    .then(() => true)
    .catch(() => false);
  if (!isOnboardingVisible) {
    return;
  }

  await startButton.click();
  // Пропускаем выбор стартовых категорий, чтобы не создавать лишние данные в БД
  await page.getByRole("button", { name: "Пропустить" }).click();
  // Пропускаем добавление стартовых товаров
  await page.getByRole("button", { name: "Пропустить" }).click();
  await page.getByRole("button", { name: "Готово" }).click();
}
