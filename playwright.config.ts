import { defineConfig, devices } from "@playwright/test";

const webPort = Number(process.env.E2E_WEB_PORT ?? 3000);
const apiPort = Number(process.env.E2E_API_PORT ?? 3001);
const baseURL = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${webPort}`;
const databaseUrl =
  process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/kupitnezabyt";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    trace: "retain-on-failure"
  },
  webServer: {
    command: "corepack pnpm dev",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      ...process.env,
      API_PORT: String(apiPort),
      APP_BASE_URL: baseURL,
      DATABASE_URL: databaseUrl,
      DEV_AUTH_ENABLED: "true",
      JWT_SECRET: process.env.JWT_SECRET ?? "e2e-secret",
      NEXT_PUBLIC_API_BASE_URL:
        process.env.NEXT_PUBLIC_API_BASE_URL ?? `http://127.0.0.1:${apiPort}`,
      NODE_ENV: "development"
    }
  },
  projects: [
    {
      name: "mobile-chromium",
      use: {
        ...devices["Pixel 5"]
      }
    }
  ]
});
