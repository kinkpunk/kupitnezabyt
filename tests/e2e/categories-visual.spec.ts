import { expect, test } from "@playwright/test";
import type { APIRequestContext, Page, TestInfo } from "@playwright/test";

const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? `http://localhost:${process.env.E2E_API_PORT ?? 3001}`;

test.describe.configure({ mode: "serial" });

test.describe("Categories screen visual regression", () => {
  let page: Page;
  let request: APIRequestContext;
  let cleanupToken: string | null = null;

  test.beforeAll(async ({ browser, request: apiRequest }, testInfo: TestInfo) => {
    request = apiRequest;
    page = await browser.newPage();

    await waitForApiHealth(request);

    const runId = `${Date.now().toString(36)}-${testInfo.workerIndex}`;
    const devUserId = `e2e-visual-${runId}`;

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

    cleanupToken = await page.evaluate(() =>
      window.localStorage.getItem("kupitnezabyt.token")
    );

    // Fix theme for deterministic screenshots.
    await page.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
  });

  test.afterAll(async () => {
    if (cleanupToken) {
      await request.delete(`${apiBaseUrl}/api/me`, {
        headers: {
          authorization: `Bearer ${cleanupToken}`
        }
      });
    }
    await page.close();
  });

  test("empty categories state", async () => {
    await page
      .getByRole("navigation", { name: "Основные разделы" })
      .getByRole("button", { name: "Категории" })
      .click();

    await expect(
      page.getByText("Создайте категорию, чтобы добавить первый товар.")
    ).toBeVisible();
    await expect(page).toHaveScreenshot("categories-empty.png");
  });

  test("active and inactive tabs", async () => {
    await page.getByRole("button", { name: "Новая категория" }).click();
    await page.getByLabel("Название категории").fill("Аптека");
    await page.getByRole("button", { name: "Создать" }).click();
    await expect(page.getByRole("tab", { name: "Аптека" })).toBeVisible();

    await page.getByRole("button", { name: "Новая категория" }).click();
    await page.getByLabel("Название категории").fill("Еда");
    await page.getByRole("button", { name: "Создать" }).click();
    await expect(page.getByRole("tab", { name: "Еда" })).toBeVisible();

    await page.getByRole("button", { name: "Новая категория" }).click();
    await page.getByLabel("Название категории").fill("Дом");
    await page.getByRole("button", { name: "Создать" }).click();
    await expect(page.getByRole("tab", { name: "Дом" })).toBeVisible();

    // Еда is selected (active), others are inactive.
    await expect(page.getByRole("tab", { name: "Еда" })).toHaveAttribute("aria-selected", "true");
    await expect(page).toHaveScreenshot("categories-tabs.png");
  });

  test("all three item statuses", async () => {
    // Еда is already selected.
    await addItemWithStatus(page, "Молоко", 0); // stays "Нет"
    await addItemWithStatus(page, "Хлеб", 1); // "Есть"
    await addItemWithStatus(page, "Сыр", 2); // "Мало"

    await expect(page.getByText("Молоко")).toBeVisible();
    await expect(page.getByText("Хлеб")).toBeVisible();
    await expect(page.getByText("Сыр")).toBeVisible();

    await expect(page).toHaveScreenshot("categories-statuses.png");
  });

  test("long product name", async () => {
    const longName = "Колбаса вареная докторская особая резерв";
    await addItemWithStatus(page, longName, 0);

    await expect(page.getByText(longName)).toBeVisible();
    await expect(page).toHaveScreenshot("categories-long-name.png");
  });

  test("empty selected category", async () => {
    await page.getByRole("button", { name: "Новая категория" }).click();
    await page.getByLabel("Название категории").fill("Пустая");
    await page.getByRole("button", { name: "Создать" }).click();
    await expect(page.getByRole("tab", { name: "Пустая" })).toBeVisible();

    await page.getByRole("tab", { name: "Пустая" }).click();
    await expect(page.getByText("Добавьте первый товар в эту категорию.")).toBeVisible();
    await expect(page).toHaveScreenshot("categories-empty-category.png");
  });
});

async function addItemWithStatus(page: Page, name: string, statusClicks: number) {
  await page.getByRole("button", { name: "Новый товар" }).click();
  await page.getByLabel("Название товара").fill(name);
  await page.getByLabel("Название товара").press("Enter");

  const row = page.locator(".ds-product-row").filter({ hasText: name });
  await expect(row).toBeVisible();

  for (let i = 0; i < statusClicks; i++) {
    await row.getByRole("button", { name: /^Статус:/ }).click();
    // Wait for the status transition to settle.
    await page.waitForTimeout(100);
  }
}

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
