import crypto from "node:crypto";

import { describe, expect, it } from "vitest";

import { signToken, validateTelegramInitData, verifyToken } from "./auth.js";
import type { ApiConfig } from "./env.js";

const config: ApiConfig = {
  appBaseUrl: "http://localhost:3000",
  jwtSecret: "test-secret",
  nodeEnv: "test",
  devAuthEnabled: false,
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
