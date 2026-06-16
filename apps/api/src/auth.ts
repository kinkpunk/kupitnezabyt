import crypto from "node:crypto";

import type { FastifyRequest } from "fastify";

import type { ApiConfig } from "./env.js";

declare module "fastify" {
  interface FastifyRequest {
    userId?: string;
  }
}

type TokenPayload = {
  sub: string;
  exp: number;
};

export type TelegramUser = {
  id: number;
  username?: string;
  first_name?: string;
  language_code?: string;
};

function base64UrlEncode(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function base64UrlDecode(input: string): Buffer {
  const padded = input.padEnd(input.length + ((4 - (input.length % 4)) % 4), "=");
  return Buffer.from(padded.replaceAll("-", "+").replaceAll("_", "/"), "base64");
}

export function signToken(userId: string, config: ApiConfig): string {
  const header = base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = base64UrlEncode(
    JSON.stringify({
      sub: userId,
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30
    } satisfies TokenPayload)
  );
  const signature = base64UrlEncode(
    crypto.createHmac("sha256", config.jwtSecret).update(`${header}.${payload}`).digest()
  );

  return `${header}.${payload}.${signature}`;
}

export function verifyToken(token: string, config: ApiConfig): TokenPayload | null {
  const parts = token.split(".");
  if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) {
    return null;
  }

  const expected = base64UrlEncode(
    crypto.createHmac("sha256", config.jwtSecret).update(`${parts[0]}.${parts[1]}`).digest()
  );

  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(parts[2]);
  if (
    expectedBuffer.length !== actualBuffer.length ||
    !crypto.timingSafeEqual(expectedBuffer, actualBuffer)
  ) {
    return null;
  }

  const payload = safeParseJson<TokenPayload>(base64UrlDecode(parts[1]).toString("utf8"));
  if (!payload?.sub || payload.exp < Math.floor(Date.now() / 1000)) {
    return null;
  }

  return payload;
}

export function getBearerToken(request: FastifyRequest): string | null {
  const header = request.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return null;
  }

  return header.slice("Bearer ".length);
}

export function validateTelegramInitData(
  initData: string,
  botToken: string,
  maxAgeSeconds = 60 * 60 * 24
): TelegramUser | null {
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  const authDate = params.get("auth_date");
  const userJson = params.get("user");

  if (!hash || !authDate || !userJson) {
    return null;
  }

  params.delete("hash");
  const dataCheckString = [...params.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  const secretKey = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
  const expectedHash = crypto
    .createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  const expectedBuffer = Buffer.from(expectedHash, "hex");
  const actualBuffer = Buffer.from(hash, "hex");
  if (
    expectedBuffer.length !== actualBuffer.length ||
    !crypto.timingSafeEqual(expectedBuffer, actualBuffer)
  ) {
    return null;
  }

  const authTimestamp = Number(authDate);
  if (!Number.isFinite(authTimestamp)) {
    return null;
  }

  const ageSeconds = Math.floor(Date.now() / 1000) - authTimestamp;
  if (ageSeconds < 0 || ageSeconds > maxAgeSeconds) {
    return null;
  }

  const user = safeParseJson<TelegramUser>(userJson);
  return typeof user?.id === "number" ? user : null;
}

function safeParseJson<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}
