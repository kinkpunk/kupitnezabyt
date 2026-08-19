#!/usr/bin/env node

const botToken = process.env.TELEGRAM_BOT_TOKEN;
const apiBaseUrl = process.env.DEPLOYED_API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL;

function fail(message) {
  console.error(
    JSON.stringify(
      {
        ok: false,
        error: message
      },
      null,
      2
    )
  );
  process.exitCode = 1;
}

function skip(reason) {
  console.log(
    JSON.stringify(
      {
        ok: true,
        skipped: true,
        reason
      },
      null,
      2
    )
  );
}

function requireUrl(name, value) {
  if (!value) {
    fail(`${name} is required for Telegram integration smoke.`);
    return null;
  }

  try {
    return new URL(value);
  } catch {
    fail(`${name} must be a valid URL.`);
    return null;
  }
}

async function fetchWithTimeout(url, options, timeoutMs = 15000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchJson(url, options) {
  const response = await fetchWithTimeout(url, options);
  const body = await response.text();

  let data;
  try {
    data = JSON.parse(body);
  } catch {
    throw new Error(`${url} did not return JSON.`);
  }

  return {
    response,
    data
  };
}

async function checkTelegramToken(token) {
  const url = new URL(`https://api.telegram.org/bot${token}/getMe`);
  const result = await fetchJson(url, { method: "POST" });

  if (!result.response.ok || result.data?.ok !== true) {
    throw new Error(
      `Telegram getMe failed: ${result.data?.description ?? result.response.statusText}`
    );
  }

  return {
    username: result.data.result?.username ?? null,
    firstName: result.data.result?.first_name ?? null
  };
}

async function checkApiHealth(baseUrl) {
  const healthUrl = new URL("/health", baseUrl);
  const detailedHealthUrl = new URL("/health/detailed", baseUrl);

  const health = await fetchJson(healthUrl, { method: "GET" });
  if (!health.response.ok || health.data?.ok !== true) {
    throw new Error(`${healthUrl} returned an unhealthy response.`);
  }

  const detailedHealth = await fetchJson(detailedHealthUrl, { method: "GET" });
  if (
    !detailedHealth.response.ok ||
    detailedHealth.data?.ok !== true ||
    detailedHealth.data?.db !== true
  ) {
    throw new Error(`${detailedHealthUrl} did not confirm database connectivity.`);
  }

  return {
    health: health.response.status,
    detailedHealth: detailedHealth.response.status
  };
}

async function checkTelegramAuthRoute(baseUrl) {
  const url = new URL("/api/auth/telegram", baseUrl);
  const result = await fetchJson(url, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({ initData: "invalid" })
  });

  if (result.response.status !== 400 && result.response.status !== 401) {
    throw new Error(
      `POST ${url} returned unexpected status ${result.response.status}; expected 400 or 401.`
    );
  }

  return {
    status: result.response.status,
    errorCode: result.data?.error?.code ?? null
  };
}

if (!botToken) {
  skip("TELEGRAM_BOT_TOKEN is not configured; Telegram integration smoke skipped.");
  process.exit();
}

const apiUrl = requireUrl("DEPLOYED_API_BASE_URL or NEXT_PUBLIC_API_BASE_URL", apiBaseUrl);
if (!apiUrl) {
  process.exit();
}

try {
  const [telegram, api, authRoute] = await Promise.all([
    checkTelegramToken(botToken),
    checkApiHealth(apiUrl),
    checkTelegramAuthRoute(apiUrl)
  ]);

  console.log(
    JSON.stringify(
      {
        ok: true,
        skipped: false,
        telegram,
        api,
        authRoute
      },
      null,
      2
    )
  );
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}
