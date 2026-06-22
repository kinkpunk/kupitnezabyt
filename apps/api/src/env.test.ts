import { afterEach, describe, expect, it } from "vitest";

import { getConfig } from "./env.js";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("getConfig", () => {
  it("rejects unsafe production configuration", () => {
    process.env.NODE_ENV = "production";
    process.env.JWT_SECRET = "replace_me";
    process.env.APP_BASE_URL = "http://localhost:3000";
    delete process.env.EMAIL_FROM;
    delete process.env.EMAIL_PROVIDER_API_KEY;

    expect(() => getConfig()).toThrow(
      "PRODUCTION_CONFIG_INVALID: JWT_SECRET, EMAIL_FROM, EMAIL_PROVIDER_API_KEY, APP_BASE_URL_HTTPS"
    );
  });

  it("accepts complete production configuration", () => {
    process.env.NODE_ENV = "production";
    process.env.JWT_SECRET = "production-secret";
    process.env.APP_BASE_URL = "https://app.example.com";
    process.env.EMAIL_FROM = "noreply@example.com";
    process.env.EMAIL_PROVIDER_API_KEY = "re_test";

    expect(getConfig()).toMatchObject({
      appBaseUrl: "https://app.example.com",
      emailFrom: "noreply@example.com",
      emailProviderApiKey: "re_test",
      jwtSecret: "production-secret",
      nodeEnv: "production"
    });
  });
});
