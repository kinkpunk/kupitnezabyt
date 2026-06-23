#!/usr/bin/env node

const apiBaseUrl = process.env.DEPLOYED_API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL;
const webappUrl = process.env.DEPLOYED_WEBAPP_URL ?? process.env.APP_BASE_URL;

function fail(message) {
  console.error(`deployment smoke failed: ${message}`);
  process.exitCode = 1;
}

function requireUrl(name, value) {
  if (!value) {
    fail(`${name} is required.`);
    return null;
  }

  try {
    const url = new URL(value);
    const isLocal =
      url.hostname === "localhost" ||
      url.hostname === "127.0.0.1" ||
      url.hostname === "::1";

    if (url.protocol !== "https:" && !isLocal) {
      fail(`${name} must use https for deployed smoke checks.`);
      return null;
    }

    return url;
  } catch {
    fail(`${name} must be a valid URL.`);
    return null;
  }
}

async function fetchWithTimeout(url, timeoutMs = 15000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      headers: {
        accept: "application/json, text/html;q=0.9, */*;q=0.8"
      },
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchJson(url) {
  const response = await fetchWithTimeout(url);
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

async function checkApiHealth(baseUrl) {
  const healthUrl = new URL("/health", baseUrl);
  const detailedHealthUrl = new URL("/health/detailed", baseUrl);
  const health = await fetchJson(healthUrl);

  if (!health.response.ok || health.data?.ok !== true) {
    throw new Error(`${healthUrl} returned an unhealthy response.`);
  }

  const detailedHealth = await fetchJson(detailedHealthUrl);
  if (
    !detailedHealth.response.ok ||
    detailedHealth.data?.ok !== true ||
    detailedHealth.data?.db !== true
  ) {
    throw new Error(`${detailedHealthUrl} did not confirm database connectivity.`);
  }

  return {
    health: health.response.status,
    detailedHealth: detailedHealth.response.status,
    env: detailedHealth.data.env ?? null,
    commit: detailedHealth.data.commit ?? null
  };
}

async function checkWebapp(baseUrl) {
  const response = await fetchWithTimeout(baseUrl);
  const contentType = response.headers.get("content-type") ?? "";

  if (!response.ok) {
    throw new Error(`${baseUrl} returned HTTP ${response.status}.`);
  }

  if (!contentType.includes("text/html")) {
    throw new Error(`${baseUrl} did not return HTML.`);
  }

  return {
    status: response.status,
    contentType
  };
}

const apiUrl = requireUrl("DEPLOYED_API_BASE_URL or NEXT_PUBLIC_API_BASE_URL", apiBaseUrl);
const appUrl = requireUrl("DEPLOYED_WEBAPP_URL or APP_BASE_URL", webappUrl);

if (!apiUrl || !appUrl) {
  process.exit();
}

try {
  const [api, webapp] = await Promise.all([
    checkApiHealth(apiUrl),
    checkWebapp(appUrl)
  ]);

  console.log(
    JSON.stringify(
      {
        ok: true,
        api,
        webapp
      },
      null,
      2
    )
  );
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}
