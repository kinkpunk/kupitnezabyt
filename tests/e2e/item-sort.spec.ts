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

  // Create items in an order that does not match status sorting. The status
  // chip UI only cycles Нет/Есть/Мало, so URGENT is set through the API the
  // same way the webapp calls it; sorting itself is still exercised via UI.
  for (const name of [inStockItemName, lowItemName, needBuyItemName, urgentItemName]) {
    await page.getByRole("button", { name: "Новый товар" }).click();
    await page.getByLabel("Название товара").fill(name);
    await page.getByLabel("Название товара").press("Enter");
    await expect(page.locator(".ds-product-row").filter({ hasText: name })).toBeVisible();
  }
  await setItemStatusViaApi(request, page, inStockItemName, "IN_STOCK");
  await setItemStatusViaApi(request, page, lowItemName, "LOW");
  await setItemStatusViaApi(request, page, needBuyItemName, "NEED_BUY");
  await setItemStatusViaApi(request, page, urgentItemName, "URGENT");

  // Reload so the category refetches the items with their new statuses.
  await page.reload({ waitUntil: "domcontentloaded" });
  await mainNavigation.getByRole("button", { name: "Категории" }).click();
  await page.getByRole("tab", { name: categoryName }).click();

  // The default sort mode is "status": items load sorted by urgency.
  const itemRows = page.locator(".ds-product-row");
  await expect(itemRows.nth(0)).toContainText(urgentItemName);
  await expect(itemRows.nth(1)).toContainText(needBuyItemName);
  await expect(itemRows.nth(2)).toContainText(lowItemName);
  await expect(itemRows.nth(3)).toContainText(inStockItemName);

  // Reorder handles should be hidden in status sort mode.
  await expect(page.locator(".ds-product-row__reorder")).toHaveCount(0);

  // Switch to manual order through the item sheet, then back to status.
  await itemRows.first().getByRole("button", { name: "Ещё" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Изменить порядок" }).click();
  // In reorder mode the row itself opens the move sheet; "Готово" leaves the
  // manual order in place.
  await page.getByRole("button", { name: inStockItemName }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Готово" }).click();
  await expect(itemRows.nth(0)).toContainText(inStockItemName);
  await expect(itemRows.nth(1)).toContainText(lowItemName);
  await expect(itemRows.nth(2)).toContainText(needBuyItemName);
  await expect(itemRows.nth(3)).toContainText(urgentItemName);

  // Back in manual mode the sheet offers status sorting again.
  const sortedItemsResponse = page.waitForResponse(
    (response) => response.url().includes("/api/items?sort=status") && response.status() === 200
  );
  await itemRows.first().getByRole("button", { name: "Ещё" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Сортировать по статусу" }).click();
  await sortedItemsResponse;
  await expect(itemRows.nth(0)).toContainText(urgentItemName);
  await expect(itemRows.nth(1)).toContainText(needBuyItemName);
  await expect(itemRows.nth(2)).toContainText(lowItemName);
  await expect(itemRows.nth(3)).toContainText(inStockItemName);

  // Reload persists the choice from localStorage.
  await page.reload({ waitUntil: "domcontentloaded" });
  await mainNavigation.getByRole("button", { name: "Категории" }).click();
  await page.getByRole("tab", { name: categoryName }).click();
  const reloadedRows = page.locator(".ds-product-row");
  await expect(reloadedRows.nth(0)).toContainText(urgentItemName);
  await expect(reloadedRows.nth(1)).toContainText(needBuyItemName);
  await expect(reloadedRows.nth(2)).toContainText(lowItemName);
  await expect(reloadedRows.nth(3)).toContainText(inStockItemName);

  const token = await page.evaluate(() => window.localStorage.getItem("kupitnezabyt.token"));
  if (token) {
    await request.delete(`${apiBaseUrl}/api/me`, {
      headers: {
        authorization: `Bearer ${token}`
      }
    });
  }
});

async function setItemStatusViaApi(
  request: APIRequestContext,
  page: Page,
  itemName: string,
  status: string
): Promise<void> {
  const token = await page.evaluate(() => window.localStorage.getItem("kupitnezabyt.token"));
  if (!token) {
    throw new Error("Token was not found in localStorage");
  }
  const headers = { authorization: `Bearer ${token}` };
  const listResponse = await request.get(`${apiBaseUrl}/api/items`, { headers });
  expect(listResponse.status()).toBe(200);
  const items = (await listResponse.json()) as Array<{ id: string; name: string }>;
  const item = items.find((entry) => entry.name === itemName);
  if (!item) {
    throw new Error(`Item "${itemName}" was not found via API`);
  }
  const statusResponse = await request.post(`${apiBaseUrl}/api/items/${item.id}/status`, {
    headers,
    data: { status }
  });
  expect(statusResponse.status()).toBe(200);
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
