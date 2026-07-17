import { expect, test } from "@playwright/test";
import type { APIRequestContext, Page } from "@playwright/test";

const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? `http://127.0.0.1:${process.env.E2E_API_PORT ?? 3001}`;

test("browser user can complete the core web-first stock flow", async ({ page, request }) => {
  test.setTimeout(90_000);

  const runId = Date.now().toString(36);
  const devUserId = `e2e-${runId}`;
  const categoryName = `E2E Категория ${runId}`;
  const itemName = `E2E Товар ${runId}`;

  await waitForApiHealth(request);

  await page.route("**/api/auth/dev", async (route) => {
    await route.continue({
      headers: {
        ...route.request().headers(),
        "content-type": "application/json"
      },
      postData: JSON.stringify({
        telegramUserId: devUserId,
        firstName: "E2E"
      })
    });
  });

  await page.goto("/", { waitUntil: "domcontentloaded" });
  await finishOnboardingIfNeeded(page);

  await expect(page.getByRole("heading", { name: /kupitnezabyt/i })).toBeVisible();
  await expect(page.getByText("Web app")).toHaveCount(0);

  const mainNavigation = page.getByRole("navigation", { name: "Основные разделы" });
  await mainNavigation.getByRole("button", { name: "Категории" }).click();

  await page.getByRole("button", { name: "Новая" }).click();
  await page.getByLabel("Название категории").fill(categoryName);
  await page.getByRole("button", { name: "Создать" }).click();
  await expect(page.getByRole("heading", { name: categoryName })).toBeVisible();

  await page.getByLabel("Название товара").fill(itemName);
  await page.getByLabel("Название товара").press("Enter");
  await expect(page.getByRole("heading", { name: itemName })).toBeVisible();
  await expect(page.getByText("Купить").first()).toBeVisible();

  await mainNavigation.getByRole("button", { name: "Меню" }).click();
  await page
    .getByRole("dialog", { name: "Дополнительные разделы" })
    .getByRole("button", { name: "Покупки" })
    .click();
  const shoppingRow = page.locator("article").filter({ hasText: itemName });
  await expect(shoppingRow).toBeVisible();
  await shoppingRow.getByRole("button", { name: "Куплено" }).click();
  await expect(shoppingRow).toHaveCount(0);

  await page.getByRole("search").getByLabel("Глобальный поиск").fill(itemName);
  await page.getByRole("button", { name: "Искать" }).click();
  await expect(page.getByRole("heading", { name: "Поиск" })).toBeVisible();
  await expect(page.locator("article").filter({ hasText: itemName })).toBeVisible();

  const token = await page.evaluate(() => window.localStorage.getItem("kupitnezabyt.token"));
  if (token) {
    await request.delete(`${apiBaseUrl}/api/me`, {
      headers: {
        authorization: `Bearer ${token}`
      }
    });
  }
});

async function waitForApiHealth(request: APIRequestContext): Promise<void> {
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

async function finishOnboardingIfNeeded(page: Page): Promise<void> {
  const startButton = page.getByRole("button", { name: "Начать" });
  if (!(await startButton.isVisible({ timeout: 10_000 }).catch(() => false))) {
    return;
  }

  await startButton.click();
  await page.getByRole("button", { name: "Продолжить" }).click();
  await page.getByRole("button", { name: "Пропустить" }).click();
  await page.getByRole("button", { name: "Готово" }).click();
}
