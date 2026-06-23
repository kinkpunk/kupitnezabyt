import crypto from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  createAppleAuthorizationUrl,
  createAppleClientSecret,
  isAppleAuthConfigured,
  isAppleEmailVerified
} from "./apple-auth.js";
import type { ApiConfig } from "./env.js";

const privateKey = crypto.generateKeyPairSync("ec", {
  namedCurve: "prime256v1"
}).privateKey.export({
  format: "pem",
  type: "pkcs8"
}) as string;

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
  appleClientId: "com.example.web",
  appleTeamId: "TEAM123456",
  appleKeyId: "KEY123456",
  applePrivateKey: privateKey,
  appleRedirectUri: "http://localhost:3001/api/auth/apple/callback",
  telegramBotToken: undefined,
  port: 3001
};

describe("apple auth helpers", () => {
  it("detects complete Apple configuration", () => {
    expect(isAppleAuthConfigured(config)).toBe(true);
    expect(isAppleAuthConfigured({ ...config, applePrivateKey: undefined })).toBe(false);
  });

  it("creates an Apple authorization URL", () => {
    const url = new URL(createAppleAuthorizationUrl(config, "state-1", "nonce-1"));

    expect(url.origin).toBe("https://appleid.apple.com");
    expect(url.pathname).toBe("/auth/authorize");
    expect(url.searchParams.get("client_id")).toBe("com.example.web");
    expect(url.searchParams.get("redirect_uri")).toBe(
      "http://localhost:3001/api/auth/apple/callback"
    );
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("response_mode")).toBe("form_post");
    expect(url.searchParams.get("scope")).toBe("openid email name");
    expect(url.searchParams.get("state")).toBe("state-1");
    expect(url.searchParams.get("nonce")).toBe("nonce-1");
  });

  it("creates a signed Apple client secret JWT", () => {
    const token = createAppleClientSecret(config, new Date("2026-06-23T12:00:00.000Z"));
    const [encodedHeader, encodedPayload, encodedSignature] = token.split(".");

    expect(encodedHeader).toBeDefined();
    expect(encodedPayload).toBeDefined();
    expect(encodedSignature).toBeDefined();

    const header = JSON.parse(Buffer.from(encodedHeader!, "base64url").toString("utf8")) as {
      alg: string;
      kid: string;
    };
    const payload = JSON.parse(Buffer.from(encodedPayload!, "base64url").toString("utf8")) as {
      aud: string;
      exp: number;
      iat: number;
      iss: string;
      sub: string;
    };

    expect(header).toMatchObject({
      alg: "ES256",
      kid: "KEY123456"
    });
    expect(payload).toMatchObject({
      aud: "https://appleid.apple.com",
      iss: "TEAM123456",
      sub: "com.example.web"
    });
    expect(payload.iat).toBe(1782216000);
    expect(payload.exp).toBe(1782219600);
  });

  it("normalizes Apple email verification claims", () => {
    expect(isAppleEmailVerified(true)).toBe(true);
    expect(isAppleEmailVerified("true")).toBe(true);
    expect(isAppleEmailVerified(false)).toBe(false);
    expect(isAppleEmailVerified("false")).toBe(false);
    expect(isAppleEmailVerified(undefined)).toBe(false);
  });
});
