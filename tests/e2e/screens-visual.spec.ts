import { expect, request as playwrightRequest, test } from "@playwright/test";
import type { APIRequestContext, BrowserContext, Page, TestInfo } from "@playwright/test";

const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? `http://localhost:${process.env.E2E_API_PORT ?? 3001}`;

test.describe.configure({ mode: "serial" });

test.describe("Screens visual regression", () => {
  let context: BrowserContext;
  let page: Page;
  let request: APIRequestContext;
  let cleanupToken: string | null = null;

  test.beforeAll(async ({ browser }, testInfo: TestInfo) => {
    request = await playwrightRequest.newContext({ baseURL: apiBaseUrl });
    context = await browser.newContext();
    page = await context.newPage();
    page.on("dialog", (dialog) => void dialog.accept());

    // Prevent Telegram WebApp script from causing a hydration mismatch in dev.
    await page.route("https://telegram.org/js/telegram-web-app.js", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/javascript",
        body: `
          window.Telegram = {
            WebApp: {
              initData: "",
              ready: function () {},
              expand: function () {},
              onEvent: function () {},
              offEvent: function () {},
              setHeaderColor: function () {},
              setBottomBarColor: function () {},
              requestFullscreen: function () {},
              disableVerticalSwipes: function () {},
              isFullscreen: false,
              viewportHeight: window.innerHeight,
              viewportStableHeight: window.innerHeight,
              safeAreaInset: { top: 0, bottom: 0, left: 0, right: 0 },
              contentSafeAreaInset: { top: 0, bottom: 0, left: 0, right: 0 },
              platform: "web",
              version: "6.0"
            }
          };
        `
      });
    });

    await waitForApiHealth(request);

    const runId = `${Date.now().toString(36)}-${testInfo.workerIndex}`;
    const devUserId = `e2e-screens-${runId}`;

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
    await request.dispose();
    await context.close();
  });

  test("home empty", async () => {
    await page.getByRole("button", { name: "Главная", exact: true }).click();
    await expect(page.getByText("Добавьте первые товары")).toBeVisible();
    await expect(page).toHaveScreenshot("home-empty.png");
  });

  test("shopping empty", async () => {
    await openMenuTab(page, "Покупки");
    await expect(page.getByText("Список покупок пуст")).toBeVisible();
    await expect(page).toHaveScreenshot("shopping-empty.png");
  });

  test("groups empty", async () => {
    await openMenuTab(page, "Наборы");
    await expect(page.getByText("Нет выбранного набора")).toBeVisible();
    await expect(page).toHaveScreenshot("groups-empty.png");
  });

  test("archive empty", async () => {
    await openMenuTab(page, "Архив");
    await expect(page.getByText("Архив пуст")).toBeVisible();
    await expect(page).toHaveScreenshot("archive-empty.png");
  });

  test("settings", async () => {
    await openMenuTab(page, "Настройки");
    await expect(page.getByText("Тема оформления")).toBeVisible();
    await expect(page).toHaveScreenshot("settings.png");
  });

  test("categories with items", async () => {
    await page.getByRole("button", { name: "Категории", exact: true }).click();
    // Use the "Еда" category created during onboarding.
    await page.getByRole("tab", { name: "Еда" }).first().click();

    await addItem(page, "Молоко");
    await addItem(page, "Хлеб");
    await addItem(page, "Сыр");

    await expect(page).toHaveScreenshot("categories-with-items.png");
  });

  test("home with data", async () => {
    await page.getByRole("button", { name: "Главная", exact: true }).click();
    await expect(page.getByText("требуют внимания")).toBeVisible();
    await expect(page).toHaveScreenshot("home-with-data.png");
  });

  test("shopping with item", async () => {
    await openMenuTab(page, "Покупки");
    await page.getByLabel("Разовая покупка").fill("Сахар");
    await page.getByLabel("Категория покупки").selectOption("Еда");
    await page.locator(".ds-shopping-form").getByRole("button", { name: "Добавить" }).click();
    await expect(page.getByText("Сахар")).toBeVisible();
    await expect(page).toHaveScreenshot("shopping-with-item.png");
  });

  test("groups with group", async () => {
    await openMenuTab(page, "Наборы");
    await page.getByLabel("Название набора").fill("Завтрак");
    await page.locator(".ds-groups-create-form").getByRole("button", { name: "Добавить" }).click();
    await page.getByRole("tab", { name: "Завтрак" }).click();
    await page.getByLabel("Товар для набора").selectOption({ label: "Молоко" });
    await page.locator(".ds-groups-add-form").getByRole("button", { name: "Добавить" }).click();
    await expect(page.getByText("Молоко")).toBeVisible();
    await expect(page).toHaveScreenshot("groups-with-group.png");
  });

  test("check screen", async () => {
    await page.getByRole("button", { name: "Категории", exact: true }).click();
    await page.locator(".ds-panel-header").getByRole("button", { name: "Проверить" }).click();
    await expect(page.getByRole("heading", { name: "Проверка" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Молоко" })).toBeVisible();
    await expect(page).toHaveScreenshot("check-in-progress.png");
  });

  test("search results", async () => {
    await page.getByRole("button", { name: "Категории", exact: true }).click();
    await page.getByRole("searchbox").fill("Молоко");
    await page.getByRole("searchbox").press("Enter");
    await expect(page.getByRole("heading", { name: "Поиск" })).toBeVisible();
    await expect(page.locator(".ds-product-row").filter({ hasText: "Молоко" })).toBeVisible();
    await expect(page).toHaveScreenshot("search-results.png");
  });

  test("menu sheet", async () => {
    await page.getByRole("button", { name: "Меню", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "Разделы" })).toBeVisible();
    await expect(page).toHaveScreenshot("menu-sheet.png");
    await page.getByRole("button", { name: "Закрыть" }).click();
  });

  test("notification sheet", async () => {
    await page.getByRole("button", { name: "Уведомления" }).click();
    const sheet = page.getByRole("dialog", { name: "Уведомления" });
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole("button", { name: /Молоко/ })).toBeVisible();
    await expect(page).toHaveScreenshot("notification-sheet.png");
    await page.getByRole("button", { name: "Закрыть" }).click();
  });

  test("archive with category", async () => {
    await page.getByRole("button", { name: "Категории", exact: true }).click();
    await page.locator(".ds-panel-header").getByRole("button", { name: "Архив" }).click();
    await openMenuTab(page, "Архив");
    await expect(page.getByText("Еда")).toBeVisible();
    await expect(page).toHaveScreenshot("archive-with-category.png");
  });
});

async function openMenuTab(page: Page, label: string) {
  await page.getByRole("button", { name: "Меню", exact: true }).click();
  await page
    .getByRole("dialog", { name: "Разделы" })
    .getByRole("button", { name: label })
    .click();
}

async function addItem(page: Page, name: string) {
  await page.getByRole("button", { name: "Новый товар" }).click();
  await page.getByLabel("Название товара").fill(name);
  await page.getByLabel("Название товара").press("Enter");

  const row = page.locator(".ds-product-row").filter({ hasText: name });
  await expect(row).toBeVisible();
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
