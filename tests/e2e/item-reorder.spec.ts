import { expect, test } from "@playwright/test";
import type { TestInfo } from "@playwright/test";

import { apiBaseUrl, finishOnboardingIfNeeded, waitForApiHealth } from "./helpers";
import { seedLegalConsent } from "./legal-consent";

test("browser user can reorder items within a category", async ({ page, request }, testInfo: TestInfo) => {
  test.setTimeout(90_000);

  const runId = `${Date.now().toString(36)}-${testInfo.workerIndex}`;
  const devUserId = `e2e-reorder-${runId}`;
  const categoryName = `E2E Reorder Категория ${runId}`;
  const firstItemName = `E2E Reorder Товар A ${runId}`;
  const secondItemName = `E2E Reorder Товар B ${runId}`;

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

  const mainNavigation = page.getByRole("navigation", { name: "Основные разделы" });
  await mainNavigation.getByRole("button", { name: "Категории" }).click();

  await page.getByRole("button", { name: "Новая" }).click();
  await page.getByLabel("Название категории").fill(categoryName);
  await page.getByRole("button", { name: "Создать" }).click();
  await expect(page.getByRole("tab", { name: categoryName })).toBeVisible();

  await page.getByRole("button", { name: "Новый товар" }).click();
  await page.getByLabel("Название товара").fill(firstItemName);
  await page.getByLabel("Название товара").press("Enter");
  await expect(page.locator(".ds-product-row").filter({ hasText: firstItemName })).toBeVisible();

  await page.getByRole("button", { name: "Новый товар" }).click();
  await page.getByLabel("Название товара").fill(secondItemName);
  await page.getByLabel("Название товара").press("Enter");
  await expect(page.locator(".ds-product-row").filter({ hasText: secondItemName })).toBeVisible();

  // Enter reorder mode from the item's "Ещё" sheet, then move the first item down.
  const firstRow = page.locator(".ds-product-row").filter({ hasText: firstItemName });
  await firstRow.getByRole("button", { name: "Ещё" }).click();
  await page
    .getByRole("dialog", { name: firstItemName })
    .getByRole("button", { name: "Изменить порядок" })
    .click();
  // In reorder mode the row itself opens the move sheet.
  await page.getByRole("button", { name: firstItemName }).click();
  const moveSheet = page.getByRole("dialog", { name: firstItemName });
  await moveSheet.getByRole("button", { name: "Вниз" }).click();
  await moveSheet.getByRole("button", { name: "Готово" }).click();

  // After moving the first item down, the second item should be first in the list.
  const itemRows = page.locator(".ds-product-row");
  await expect(itemRows.nth(0)).toContainText(secondItemName);
  await expect(itemRows.nth(1)).toContainText(firstItemName);

  await page.reload({ waitUntil: "domcontentloaded" });
  await mainNavigation.getByRole("button", { name: "Категории" }).click();
  await page.getByRole("tab", { name: categoryName }).click();
  const reloadedRows = page.locator(".ds-product-row");
  await expect(reloadedRows.nth(0)).toContainText(secondItemName);
  await expect(reloadedRows.nth(1)).toContainText(firstItemName);

  const token = await page.evaluate(() => window.localStorage.getItem("kupitnezabyt.token"));
  if (token) {
    await request.delete(`${apiBaseUrl}/api/me`, {
      headers: {
        authorization: `Bearer ${token}`
      }
    });
  }
});
