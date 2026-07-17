import { expect, test } from "@playwright/test";
import type { APIRequestContext, Page } from "@playwright/test";

const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? `http://127.0.0.1:${process.env.E2E_API_PORT ?? 3001}`;
const webBaseUrl = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${process.env.E2E_WEB_PORT ?? 3000}`;

test("two accounts can share and edit a workspace", async ({ browser, request }) => {
  test.setTimeout(120_000);

  const runId = Date.now().toString(36);
  const ownerEmail = `e2e-owner-${runId}@example.com`;
  const memberEmail = `e2e-member-${runId}@example.com`;
  const categoryName = `E2E Категория ${runId}`;
  const itemName = `E2E Товар ${runId}`;

  await waitForApiHealth(request);

  // Owner signs in via email magic link.
  const ownerContext = await browser.newContext();
  const ownerPage = await ownerContext.newPage();
  const ownerToken = await signInWithEmail(ownerPage, request, ownerEmail);
  await finishOnboardingIfNeeded(ownerPage);

  // Owner creates a category and an item.
  const ownerNavigation = ownerPage.getByRole("navigation", { name: "Основные разделы" });
  await ownerNavigation.getByRole("button", { name: "Категории" }).click();

  await ownerPage.getByRole("button", { name: "Новая" }).click();
  await ownerPage.getByLabel("Название категории").fill(categoryName);
  await ownerPage.getByRole("button", { name: "Создать" }).click();
  await expect(ownerPage.getByRole("heading", { name: categoryName })).toBeVisible();

  await ownerPage.getByLabel("Название товара").fill(itemName);
  await ownerPage.getByLabel("Название товара").press("Enter");
  await expect(ownerPage.getByRole("heading", { name: itemName })).toBeVisible();
  await expect(ownerPage.getByText("Купить").first()).toBeVisible();

  // Owner invites the member via API and captures the dev invitation link.
  const ownerWorkspace = await getOwnerWorkspace(request, ownerToken);
  const inviteResponse = await request.post(
    `${apiBaseUrl}/api/workspaces/${ownerWorkspace.id}/invitations`,
    {
      headers: {
        authorization: `Bearer ${ownerToken}`
      },
      data: {
        email: memberEmail
      }
    }
  );
  expect(inviteResponse.status()).toBe(200);
  const inviteBody = (await inviteResponse.json()) as {
    devInvitationLink?: string;
  };
  const devInvitationLink = inviteBody.devInvitationLink;
  expect(devInvitationLink).toBeDefined();

  // Member signs in and accepts the invitation in one navigation.
  const memberContext = await browser.newContext();
  const memberPage = await memberContext.newPage();
  const memberMagicLink = await requestMagicLink(request, memberEmail);
  const memberMagicToken = extractQueryParam(memberMagicLink, "magic_token");
  const invitationToken = extractQueryParam(devInvitationLink, "workspace_invite_token");

  const memberEntryUrl = new URL(webBaseUrl);
  memberEntryUrl.searchParams.set("magic_token", memberMagicToken);
  memberEntryUrl.searchParams.set("workspace_invite_token", invitationToken);

  await memberPage.goto(memberEntryUrl.toString(), { waitUntil: "domcontentloaded" });

  // Member should land in the shared workspace and see the owner's data.
  await expect(memberPage.getByRole("heading", { name: categoryName })).toBeVisible();
  await expect(memberPage.getByRole("heading", { name: itemName })).toBeVisible();

  // Member changes the item status to IN_STOCK.
  const memberItem = memberPage.locator("article").filter({ hasText: itemName });
  await memberItem.getByRole("combobox").selectOption("IN_STOCK");
  await expect(memberItem.getByRole("combobox")).toHaveValue("IN_STOCK");

  // Owner refreshes and sees the change made by the member.
  await ownerPage.reload({ waitUntil: "domcontentloaded" });
  const ownerItem = ownerPage.locator("article").filter({ hasText: itemName });
  await expect(ownerItem.getByRole("combobox")).toHaveValue("IN_STOCK");

  // Owner removes the member from the workspace.
  await ownerNavigation.getByRole("button", { name: "Меню" }).click();
  await ownerPage
    .getByRole("dialog", { name: "Дополнительные разделы" })
    .getByRole("button", { name: "Настройки" })
    .click();
  ownerPage.on("dialog", (dialog) => void dialog.accept());
  await ownerPage
    .getByRole("button", { name: `Удалить доступ для ${memberEmail}` })
    .click();
  await expect(ownerPage.getByText(/Доступ для .* удален/)).toBeVisible();

  // Member refreshes and loses access to the shared workspace.
  await memberPage.reload({ waitUntil: "domcontentloaded" });
  await expect(memberPage.getByRole("heading", { name: categoryName })).toHaveCount(0);
  await expect(memberPage.getByRole("heading", { name: itemName })).toHaveCount(0);

  // Cleanup.
  const memberToken = await memberPage.evaluate(() =>
    window.localStorage.getItem("kupitnezabyt.token")
  );
  await ownerContext.close();
  await memberContext.close();
  await cleanupUser(request, ownerToken);
  if (memberToken) {
    await cleanupUser(request, memberToken);
  }
});

async function requestMagicLink(request: APIRequestContext, email: string): Promise<string> {
  const response = await request.post(`${apiBaseUrl}/api/auth/email/request`, {
    data: { email }
  });
  expect(response.status()).toBe(200);
  const body = (await response.json()) as { devMagicLink: string };
  return body.devMagicLink;
}

function extractQueryParam(url: string, name: string): string {
  const parsedUrl = new URL(url);
  const value = parsedUrl.searchParams.get(name);
  if (!value) {
    throw new Error(`Missing "${name}" in URL: ${url}`);
  }
  return value;
}

async function signInWithEmail(
  page: Page,
  request: APIRequestContext,
  email: string
): Promise<string> {
  const magicLink = await requestMagicLink(request, email);
  const magicToken = extractQueryParam(magicLink, "magic_token");
  await page.goto(`/?magic_token=${magicToken}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: /kupitnezabyt/i })).toBeVisible();
  const token = await page.evaluate(() => window.localStorage.getItem("kupitnezabyt.token"));
  if (!token) {
    throw new Error("Token was not saved after email sign-in");
  }
  return token;
}

async function getOwnerWorkspace(
  request: APIRequestContext,
  token: string
): Promise<{ id: string; name: string }> {
  const response = await request.get(`${apiBaseUrl}/api/workspaces`, {
    headers: {
      authorization: `Bearer ${token}`
    }
  });
  expect(response.status()).toBe(200);
  const workspaces = (await response.json()) as Array<{ id: string; name: string; role: string }>;
  const ownerWorkspace = workspaces.find((workspace) => workspace.role === "OWNER");
  if (!ownerWorkspace) {
    throw new Error("Owner workspace was not found");
  }
  return ownerWorkspace;
}

async function cleanupUser(request: APIRequestContext, token: string): Promise<void> {
  await request.delete(`${apiBaseUrl}/api/me`, {
    headers: {
      authorization: `Bearer ${token}`
    }
  });
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
  if (!(await startButton.isVisible({ timeout: 10_000 }).catch(() => false))) {
    return;
  }

  await startButton.click();
  await page.getByRole("button", { name: "Продолжить" }).click();
  await page.getByRole("button", { name: "Пропустить" }).click();
  await page.getByRole("button", { name: "Готово" }).click();
}
