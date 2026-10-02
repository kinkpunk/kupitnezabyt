import { expect, test } from "@playwright/test";
import type { TestInfo } from "@playwright/test";

import { apiBaseUrl, finishOnboardingIfNeeded, waitForApiHealth } from "./helpers";
import { seedLegalConsent } from "./legal-consent";

test("browser user can complete the core web-first stock flow", async ({ page, request }, testInfo: TestInfo) => {
  test.setTimeout(90_000);

  const runId = `${Date.now().toString(36)}-${testInfo.workerIndex}`;
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
        ...JSON.parse(route.request().postData() ?? "{}"),
        telegramUserId: devUserId,
        firstName: "E2E"
      })
    });
  });

  await seedLegalConsent(page.context());
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await finishOnboardingIfNeeded(page);

  // Home intentionally has no product-name heading; its stock summary and
  // navigation establish that an authenticated app shell has loaded.
  await expect(page.getByRole("heading", { name: "Купить сейчас" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Основные разделы" })).toBeVisible();
  await expect(page.getByText("Web app")).toHaveCount(0);

  const mainNavigation = page.getByRole("navigation", { name: "Основные разделы" });
  await mainNavigation.getByRole("button", { name: "Категории" }).click();

  await page.getByRole("button", { name: "Новая" }).click();
  await page.getByLabel("Название категории").fill(categoryName);
  await page.getByRole("button", { name: "Создать" }).click();
  await expect(page.getByRole("tab", { name: categoryName })).toBeVisible();

  await page.getByRole("button", { name: "Новый товар" }).click();
  await page.getByLabel("Название товара").fill(itemName);
  await page.getByLabel("Название товара").press("Enter");
  const createdItem = page.locator(".ds-product-row").filter({ hasText: itemName });
  await expect(createdItem).toBeVisible();
  // A new item starts in the "Нет" (NEED_BUY) status chip.
  await expect(createdItem.getByRole("button", { name: /Статус: Нет/ })).toBeVisible();

  await mainNavigation.getByRole("button", { name: "Покупки" }).click();
  const shoppingRow = page.locator(".ds-product-row").filter({ hasText: itemName });
  await expect(shoppingRow).toBeVisible();
  await shoppingRow.getByRole("button", { name: "Куплено" }).click();
  await expect(shoppingRow).toHaveCount(0);

  const searchBox = page.getByRole("searchbox", { name: "Поиск" });
  await mainNavigation.getByRole("button", { name: "Категории" }).click();
  await searchBox.fill(itemName);
  await searchBox.press("Enter");
  await expect(page.getByRole("heading", { name: "Поиск" })).toBeVisible();
  await expect(page.locator(".ds-product-row").filter({ hasText: itemName })).toBeVisible();

  const token = await page.evaluate(() => window.localStorage.getItem("kupitnezabyt.token"));
  if (token) {
    await request.delete(`${apiBaseUrl}/api/me`, {
      headers: {
        authorization: `Bearer ${token}`
      }
    });
  }
});
