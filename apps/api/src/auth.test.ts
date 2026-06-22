import crypto from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  calculateMagicLinkExpiresAt,
  calculateOAuthStateExpiresAt,
  hashMagicLinkToken,
  hashOAuthSecret,
  isUsableMagicLinkToken,
  isUsableOAuthStateToken,
  normalizeEmail,
  signToken,
  validateTelegramInitData,
  verifyToken
} from "./auth.js";
import type { ApiConfig } from "./env.js";

const config: ApiConfig = {
  appBaseUrl: "http://localhost:3000",
  emailFrom: undefined,
  emailProviderApiKey: undefined,
  jwtSecret: "test-secret",
  magicLinkTokenTtlMinutes: 15,
  nodeEnv: "test",
  devAuthEnabled: false,
  googleClientId: undefined,
  googleClientSecret: undefined,
  googleRedirectUri: undefined,
  telegramBotToken: "bot-token",
  port: 3001
};

describe("JWT auth", () => {
  it("verifies a signed token", () => {
    const token = signToken("user-1", config);

    expect(verifyToken(token, config)?.sub).toBe("user-1");
  });

  it("rejects a tampered token", () => {
    const token = signToken("user-1", config);
    const tamperedToken = `${token.slice(0, -1)}x`;

    expect(verifyToken(tamperedToken, config)).toBeNull();
  });
});

describe("email magic link auth helpers", () => {
  it("normalizes valid email addresses", () => {
    expect(normalizeEmail("  USER@Example.COM ")).toBe("user@example.com");
  });

  it("rejects invalid email addresses", () => {
    expect(normalizeEmail("missing-at")).toBeNull();
    expect(normalizeEmail("a@b")).toBeNull();
    expect(normalizeEmail("a b@example.com")).toBeNull();
  });

  it("hashes tokens without exposing the raw token", () => {
    const hash = hashMagicLinkToken("raw-token", config);

    expect(hash).not.toBe("raw-token");
    expect(hash).toBe(hashMagicLinkToken("raw-token", config));
    expect(hash).not.toBe(hashMagicLinkToken("other-token", config));
  });

  it("calculates expiry and rejects expired or consumed tokens", () => {
    const now = new Date("2026-06-21T12:00:00.000Z");
    const expiresAt = calculateMagicLinkExpiresAt(now, 15);

    expect(expiresAt.toISOString()).toBe("2026-06-21T12:15:00.000Z");
    expect(isUsableMagicLinkToken({ consumedAt: null, expiresAt }, now)).toBe(true);
    expect(isUsableMagicLinkToken({ consumedAt: now, expiresAt }, now)).toBe(false);
    expect(isUsableMagicLinkToken({ consumedAt: null, expiresAt: now }, now)).toBe(false);
    expect(isUsableMagicLinkToken(null, now)).toBe(false);
  });
});

describe("OAuth state helpers", () => {
  it("hashes provider state and nonce without exposing raw values", () => {
    const hash = hashOAuthSecret("raw-state", config);

    expect(hash).not.toBe("raw-state");
    expect(hash).toBe(hashOAuthSecret("raw-state", config));
    expect(hash).not.toBe(hashOAuthSecret("other-state", config));
  });

  it("calculates short expiry and rejects expired or consumed state", () => {
    const now = new Date("2026-06-22T12:00:00.000Z");
    const expiresAt = calculateOAuthStateExpiresAt(now);

    expect(expiresAt.toISOString()).toBe("2026-06-22T12:10:00.000Z");
    expect(isUsableOAuthStateToken({ consumedAt: null, expiresAt }, now)).toBe(true);
    expect(isUsableOAuthStateToken({ consumedAt: now, expiresAt }, now)).toBe(false);
    expect(isUsableOAuthStateToken({ consumedAt: null, expiresAt: now }, now)).toBe(false);
    expect(isUsableOAuthStateToken(null, now)).toBe(false);
  });
});

describe("validateTelegramInitData", () => {
  const now = new Date("2026-06-16T12:00:00.000Z");
  const botToken = "123456:telegram-token";

  it("accepts valid init data", () => {
    const initData = buildInitData({
      authDate: Math.floor(now.getTime() / 1000),
      botToken,
      user: {
        id: 42,
        username: "alice",
        first_name: "Alice",
        language_code: "ru"
      }
    });

    expect(validateTelegramInitData(initData, botToken, 86400, now)).toEqual({
      id: 42,
      username: "alice",
      first_name: "Alice",
      language_code: "ru"
    });
  });

  it("rejects expired init data", () => {
    const initData = buildInitData({
      authDate: Math.floor(now.getTime() / 1000) - 86401,
      botToken,
      user: {
        id: 42
      }
    });

    expect(validateTelegramInitData(initData, botToken, 86400, now)).toBeNull();
  });

  it("rejects invalid signatures", () => {
    const initData = buildInitData({
      authDate: Math.floor(now.getTime() / 1000),
      botToken,
      user: {
        id: 42
      }
    });

    const params = new URLSearchParams(initData);
    params.set("user", JSON.stringify({ id: 43 }));

    expect(validateTelegramInitData(params.toString(), botToken, 86400, now)).toBeNull();
  });
});

function buildInitData(input: {
  authDate: number;
  botToken: string;
  user: Record<string, unknown>;
}): string {
  const params = new URLSearchParams({
    auth_date: String(input.authDate),
    user: JSON.stringify(input.user)
  });
  const dataCheckString = [...params.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  const secretKey = crypto.createHmac("sha256", "WebAppData").update(input.botToken).digest();
  const hash = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
  params.set("hash", hash);

  return params.toString();
}
