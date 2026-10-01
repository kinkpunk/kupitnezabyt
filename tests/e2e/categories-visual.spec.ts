import { expect, request as playwrightRequest, test } from "@playwright/test";
import type { APIRequestContext, Page, TestInfo } from "@playwright/test";

import { apiBaseUrl, skipOnboardingIfNeeded, waitForApiHealth } from "./helpers";
import { seedLegalConsent } from "./legal-consent";

test.describe.configure({ mode: "serial" });

test.describe("Categories screen visual regression", () => {
  let page: Page;
  let request: APIRequestContext;
  let cleanupToken: string | null = null;

  test.beforeAll(async ({ browser }, testInfo: TestInfo) => {
    // Создаём контекст вручную: фикстура { request } из beforeAll недоступна в afterAll.
    request = await playwrightRequest.newContext({ baseURL: apiBaseUrl });
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
          ...JSON.parse(route.request().postData() ?? "{}"),
          telegramUserId: devUserId,
          firstName: "E2E"
        })
      });
    });

    await seedLegalConsent(page.context());
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await skipOnboardingIfNeeded(page);

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

    // После создания категории автоматически выбирается последняя, поэтому Еда выбираем явно.
    await page.getByRole("tab", { name: "Еда" }).click();
    await expect(page.getByRole("tab", { name: "Еда" })).toHaveAttribute("aria-selected", "true");
    await expect(page).toHaveScreenshot("categories-tabs.png");
  });

  test("all three item statuses", async () => {
    // Еда is already selected.
    await addItemWithStatus(page, "Молоко", 0); // stays "Нет"
    await addItemWithStatus(page, "Хлеб", 1); // "Есть"
    await addItemWithStatus(page, "Сыр", 2); // "Мало"

    await expect(page.getByText("Молоко", { exact: true })).toBeVisible();
    await expect(page.getByText("Хлеб", { exact: true })).toBeVisible();
    await expect(page.getByText("Сыр", { exact: true })).toBeVisible();

    // Подписи «Проверено <дата>» зависят от текущего дня — исключаем их из сравнения.
    await expect(page).toHaveScreenshot("categories-statuses.png", {
      mask: [page.locator(".ds-product-row__subtitle").filter({ hasText: /\d/ })]
    });
  });

  test("long product name", async () => {
    const longName = "Колбаса вареная докторская особая резерв";
    await addItemWithStatus(page, longName, 0);

    await expect(page.getByText(longName)).toBeVisible();
    // Соседние строки показывают «Проверено <дата>» — исключаем дату из сравнения.
    await expect(page).toHaveScreenshot("categories-long-name.png", {
      mask: [page.locator(".ds-product-row__subtitle").filter({ hasText: /\d/ })]
    });
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

  // Статус обновляется только после ответа сервера (без optimistic update),
  // поэтому ждём смены aria-label кнопки вместо фиксированной задержки.
  const statusButton = row.getByRole("button", { name: /^Статус:/ });
  for (let i = 0; i < statusClicks; i++) {
    const previousLabel = await statusButton.getAttribute("aria-label");

    await statusButton.click();

    await expect
      .poll(() => statusButton.getAttribute("aria-label"))
      .not.toBe(previousLabel);
  }
}
