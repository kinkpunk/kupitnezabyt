import { expect, test } from "@playwright/test";
import type { APIRequestContext, Page, TestInfo } from "@playwright/test";
import { readFile } from "node:fs/promises";

const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? `http://localhost:${process.env.E2E_API_PORT ?? 3001}`;

test("user can group items and run a group check session", async ({ page, request }, testInfo: TestInfo) => {
  test.setTimeout(120_000);

  const runId = `${Date.now().toString(36)}-${testInfo.workerIndex}`;
  const categoryName = `E2E Наборы ${runId}`;
  const itemName = `E2E Товар набора ${runId}`;
  const groupName = `E2E Набор ${runId}`;

  await waitForApiHealth(request);
  await signInWithDevAuth(page, runId);
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await finishOnboardingIfNeeded(page);

  // Create a category and an item to put into the group.
  const mainNavigation = page.getByRole("navigation", { name: "Основные разделы" });
  await mainNavigation.getByRole("button", { name: "Категории" }).click();
  await page.getByRole("button", { name: "Новая" }).click();
  await page.getByLabel("Название категории").fill(categoryName);
  await page.getByRole("button", { name: "Создать" }).click();
  await expect(page.getByRole("tab", { name: categoryName })).toBeVisible();

  await page.getByRole("button", { name: "Новый товар" }).click();
  await page.getByLabel("Название товара").fill(itemName);
  await page.getByLabel("Название товара").press("Enter");
  await expect(page.getByRole("heading", { name: itemName })).toBeVisible();

  // Create a group and add the item to it.
  await mainNavigation.getByRole("button", { name: "Меню" }).click();
  await page
    .getByRole("dialog", { name: "Дополнительные разделы" })
    .getByRole("button", { name: "Наборы" })
    .click();

  await page.getByLabel("Название набора").fill(groupName);
  await page.getByLabel("Название набора").press("Enter");
  await expect(
    page.locator("[aria-label='Наборы']").getByRole("button", { name: new RegExp(groupName) })
  ).toBeVisible();

  await page.getByLabel("Товар для набора").selectOption({ label: itemName });
  await page
    .locator("form")
    .filter({ has: page.getByLabel("Товар для набора") })
    .getByRole("button", { name: "Добавить" })
    .click();
  await expect(
    page.locator("article").filter({ hasText: itemName }).getByRole("heading", { name: itemName })
  ).toBeVisible();

  // Run the group check session to completion.
  await page.getByRole("button", { name: "Проверить" }).click();
  await expect(page.getByRole("heading", { name: "Проверка" })).toBeVisible();
  const checkCard = page.locator("article.check-card");
  await expect(checkCard.getByRole("heading", { name: itemName })).toBeVisible();
  await checkCard.getByRole("button", { name: "Есть" }).click();
  await expect(page.getByText("Проверка завершена.")).toBeVisible();

  // The item status is updated by the completed session.
  await mainNavigation.getByRole("button", { name: "Категории" }).click();
  await expect(page.getByLabel(`Статус товара ${itemName}`)).toHaveValue("IN_STOCK");

  await cleanupUser(page, request);
});

test("user can run a step-by-step category check and search in different ways", async ({
  page,
  request
}, testInfo: TestInfo) => {
  test.setTimeout(120_000);

  const runId = `${Date.now().toString(36)}-${testInfo.workerIndex}`;
  const categoryName = `E2E Проверка ${runId}`;
  const firstItemName = `E2E Товар ${runId} A`;
  const secondItemName = `E2E Товар ${runId} B`;

  await waitForApiHealth(request);
  await signInWithDevAuth(page, runId);
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await finishOnboardingIfNeeded(page);

  const mainNavigation = page.getByRole("navigation", { name: "Основные разделы" });
  await mainNavigation.getByRole("button", { name: "Категории" }).click();
  await page.getByRole("button", { name: "Новая" }).click();
  await page.getByLabel("Название категории").fill(categoryName);
  await page.getByRole("button", { name: "Создать" }).click();
  await expect(page.getByRole("tab", { name: categoryName })).toBeVisible();

  await page.getByRole("button", { name: "Новый товар" }).click();
  await page.getByLabel("Название товара").fill(firstItemName);
  await page.getByLabel("Название товара").press("Enter");
  await expect(page.getByRole("heading", { name: firstItemName })).toBeVisible();
  await page.getByRole("button", { name: "Новый товар" }).click();
  await page.getByLabel("Название товара").fill(secondItemName);
  await page.getByLabel("Название товара").press("Enter");
  await expect(page.getByRole("heading", { name: secondItemName })).toBeVisible();

  // Start the category check session from the category panel.
  await page
    .getByRole("tabpanel", { name: categoryName })
    .getByRole("button", { name: "Проверить" })
    .click();
  await expect(page.getByRole("heading", { name: "Проверка" })).toBeVisible();

  // Answer both items; the session completes automatically after the last one.
  const checkCard = page.locator("article.check-card");
  await expect(checkCard).toBeVisible();
  const firstCheckedName = (await checkCard.locator("h2").textContent())?.trim() ?? "";
  await checkCard.getByRole("button", { name: "Мало" }).click();
  await expect(checkCard.locator("h2")).not.toHaveText(firstCheckedName);
  const secondCheckedName = (await checkCard.locator("h2").textContent())?.trim() ?? "";
  await checkCard.getByRole("button", { name: "Купить" }).click();
  await expect(page.getByText("Проверка завершена.")).toBeVisible();

  const statusByItem = new Map([
    [firstCheckedName, "LOW"],
    [secondCheckedName, "NEED_BUY"]
  ]);

  await mainNavigation.getByRole("button", { name: "Категории" }).click();
  await expect(page.getByLabel(`Статус товара ${firstItemName}`)).toHaveValue(
    statusByItem.get(firstItemName) ?? "LOW"
  );
  await expect(page.getByLabel(`Статус товара ${secondItemName}`)).toHaveValue(
    statusByItem.get(secondItemName) ?? "NEED_BUY"
  );

  // Search variant 1: a partial query matches both items.
  const searchRegion = page.getByRole("search");
  await searchRegion.getByLabel("Глобальный поиск").fill(runId);
  await searchRegion.getByRole("button", { name: "Искать" }).click();
  await expect(page.getByRole("heading", { name: "Поиск" })).toBeVisible();
  await expect(page.getByRole("heading", { name: firstItemName })).toBeVisible();
  await expect(page.getByRole("heading", { name: secondItemName })).toBeVisible();

  // Search variant 2: a query without matches shows the empty state.
  await searchRegion.getByLabel("Глобальный поиск").fill(`нет-такого-${runId}`);
  await searchRegion.getByRole("button", { name: "Искать" }).click();
  await expect(page.getByText("Ничего не найдено.")).toBeVisible();

  await cleanupUser(page, request);
});

test("user can archive and restore an item and export their data as JSON", async ({
  page,
  request
}, testInfo: TestInfo) => {
  test.setTimeout(120_000);

  const runId = `${Date.now().toString(36)}-${testInfo.workerIndex}`;
  const categoryName = `E2E Архив ${runId}`;
  const itemName = `E2E Товар архива ${runId}`;

  await waitForApiHealth(request);
  await signInWithDevAuth(page, runId);
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await finishOnboardingIfNeeded(page);

  const mainNavigation = page.getByRole("navigation", { name: "Основные разделы" });
  await mainNavigation.getByRole("button", { name: "Категории" }).click();
  await page.getByRole("button", { name: "Новая" }).click();
  await page.getByLabel("Название категории").fill(categoryName);
  await page.getByRole("button", { name: "Создать" }).click();
  await expect(page.getByRole("tab", { name: categoryName })).toBeVisible();

  await page.getByRole("button", { name: "Новый товар" }).click();
  await page.getByLabel("Название товара").fill(itemName);
  await page.getByLabel("Название товара").press("Enter");
  await expect(page.getByRole("heading", { name: itemName })).toBeVisible();

  // Archive the item and find it in the archive section.
  page.once("dialog", (dialog) => void dialog.accept());
  await page.getByLabel(`Архивировать товар ${itemName}`).click();
  // Archiving removes the item from the active category immediately; the
  // archive is loaded separately below to verify the persisted result.
  await expect(page.getByRole("heading", { name: itemName })).toHaveCount(0);

  await mainNavigation.getByRole("button", { name: "Меню" }).click();
  await page
    .getByRole("dialog", { name: "Дополнительные разделы" })
    .getByRole("button", { name: "Архив" })
    .click();
  const archivedItem = page
    .getByLabel("Архивные товары")
    .locator("article")
    .filter({ hasText: itemName });
  await expect(archivedItem).toBeVisible();

  // Restore the item back into its category.
  await archivedItem.getByRole("button", { name: "Вернуть" }).click();
  await expect(archivedItem).toHaveCount(0);
  await mainNavigation.getByRole("button", { name: "Категории" }).click();
  await expect(page.getByRole("heading", { name: itemName })).toBeVisible();

  // Export user data and verify the downloaded JSON contains the item.
  await mainNavigation.getByRole("button", { name: "Меню" }).click();
  await page
    .getByRole("dialog", { name: "Дополнительные разделы" })
    .getByRole("button", { name: "Настройки" })
    .click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Скачать JSON" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^kupitnezabyt-export-.*\.json$/);
  const downloadPath = await download.path();
  if (!downloadPath) {
    throw new Error("Export download did not produce a file");
  }
  const exported = JSON.parse(await readFile(downloadPath, "utf-8")) as {
    schemaVersion: number;
    data: Record<string, unknown>;
  };
  expect(exported.schemaVersion).toBe(1);
  expect(JSON.stringify(exported.data)).toContain(itemName);

  await cleanupUser(page, request);
});

async function signInWithDevAuth(page: Page, runId: string): Promise<void> {
  await page.route("**/api/auth/dev", async (route) => {
    await route.continue({
      headers: {
        ...route.request().headers(),
        "content-type": "application/json"
      },
      postData: JSON.stringify({
        telegramUserId: `e2e-${runId}`,
        firstName: "E2E"
      })
    });
  });
}

async function cleanupUser(page: Page, request: APIRequestContext): Promise<void> {
  const token = await page.evaluate(() => window.localStorage.getItem("kupitnezabyt.token"));
  if (token) {
    await request.delete(`${apiBaseUrl}/api/me`, {
      headers: {
        authorization: `Bearer ${token}`
      }
    });
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
