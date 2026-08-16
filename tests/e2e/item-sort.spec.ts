import { expect, test } from "@playwright/test";
import type { APIRequestContext, Page, TestInfo } from "@playwright/test";

const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? `http://localhost:${process.env.E2E_API_PORT ?? 3001}`;

test("browser user can sort category items by status", async ({ page, request }, testInfo: TestInfo) => {
  test.setTimeout(90_000);

  const runId = `${Date.now().toString(36)}-${testInfo.workerIndex}`;
  const devUserId = `e2e-sort-${runId}`;
  const categoryName = `E2E Sort Категория ${runId}`;
  const inStockItemName = `E2E Sort Есть ${runId}`;
  const lowItemName = `E2E Sort Мало ${runId}`;
  const needBuyItemName = `E2E Sort Купить ${runId}`;
  const urgentItemName = `E2E Sort Срочно ${runId}`;

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

  const mainNavigation = page.getByRole("navigation", { name: "Основные разделы" });
  await mainNavigation.getByRole("button", { name: "Категории" }).click();

  await page.getByRole("button", { name: "Новая" }).click();
  await page.getByLabel("Название категории").fill(categoryName);
  await page.getByRole("button", { name: "Создать" }).click();
  await expect(page.getByRole("tab", { name: categoryName })).toBeVisible();

  // Create items in an order that does not match status sorting.
  await page.getByLabel("Название товара").fill(inStockItemName);
  await page.getByLabel("Название товара").press("Enter");
  await expect(page.getByRole("heading", { name: inStockItemName })).toBeVisible();
  await page
    .getByRole("combobox", { name: `Статус товара ${inStockItemName}` })
    .selectOption("IN_STOCK");

  await page.getByLabel("Название товара").fill(lowItemName);
  await page.getByLabel("Название товара").press("Enter");
  await expect(page.getByRole("heading", { name: lowItemName })).toBeVisible();
  await page.getByRole("combobox", { name: `Статус товара ${lowItemName}` }).selectOption("LOW");

  await page.getByLabel("Название товара").fill(needBuyItemName);
  await page.getByLabel("Название товара").press("Enter");
  await expect(page.getByRole("heading", { name: needBuyItemName })).toBeVisible();
  await page
    .getByRole("combobox", { name: `Статус товара ${needBuyItemName}` })
    .selectOption("NEED_BUY");

  await page.getByLabel("Название товара").fill(urgentItemName);
  await page.getByLabel("Название товара").press("Enter");
  await expect(page.getByRole("heading", { name: urgentItemName })).toBeVisible();
  await page
    .getByRole("combobox", { name: `Статус товара ${urgentItemName}` })
    .selectOption("URGENT");

  // Switch to status sorting and wait for the sorted items to load.
  const sortedItemsResponse = page.waitForResponse(
    (response) => response.url().includes("/api/items?sort=status") && response.status() === 200
  );
  await page.getByRole("group", { name: "Сортировка товаров" }).getByRole("button", { name: "По статусу" }).click();
  await sortedItemsResponse;

  const itemCards = page.locator("article.item-card");
  await expect(itemCards.nth(0)).toContainText(urgentItemName);
  await expect(itemCards.nth(1)).toContainText(needBuyItemName);
  await expect(itemCards.nth(2)).toContainText(lowItemName);
  await expect(itemCards.nth(3)).toContainText(inStockItemName);

  // Reorder arrows should be hidden in status sort mode.
  await expect(
    page.getByRole("button", { name: `Переместить товар ${urgentItemName} ниже` })
  ).not.toBeVisible();

  // Reload persists the choice from localStorage.
  await page.reload({ waitUntil: "domcontentloaded" });
  await mainNavigation.getByRole("button", { name: "Категории" }).click();
  await page.getByRole("tab", { name: categoryName }).click();
  const reloadedCards = page.locator("article.item-card");
  await expect(reloadedCards.nth(0)).toContainText(urgentItemName);
  await expect(reloadedCards.nth(1)).toContainText(needBuyItemName);
  await expect(reloadedCards.nth(2)).toContainText(lowItemName);
  await expect(reloadedCards.nth(3)).toContainText(inStockItemName);

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
