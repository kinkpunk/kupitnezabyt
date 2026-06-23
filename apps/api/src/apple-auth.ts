import crypto from "node:crypto";

import type { ApiConfig } from "./env.js";

type AppleTokenResponse = {
  id_token?: string;
  error?: string;
  error_description?: string;
};

type AppleJwk = {
  kid: string;
  kty: string;
  alg?: string;
  use?: string;
  n: string;
  e: string;
};

type AppleJwksResponse = {
  keys?: AppleJwk[];
};

type AppleIdTokenHeader = {
  alg: string;
  kid: string;
};

export type AppleIdTokenPayload = {
  iss: string;
  aud: string;
  exp: number;
  sub: string;
  email?: string;
  email_verified?: boolean | string;
  nonce?: string;
};

export function isAppleAuthConfigured(config: ApiConfig): boolean {
  return Boolean(
    config.appleClientId &&
      config.appleTeamId &&
      config.appleKeyId &&
      config.applePrivateKey &&
      config.appleRedirectUri
  );
}

export function createAppleAuthorizationUrl(
  config: ApiConfig,
  state: string,
  nonce: string
): string {
  if (!config.appleClientId || !config.appleRedirectUri) {
    throw new Error("APPLE_AUTH_NOT_CONFIGURED");
  }

  const url = new URL("https://appleid.apple.com/auth/authorize");
  url.searchParams.set("client_id", config.appleClientId);
  url.searchParams.set("redirect_uri", config.appleRedirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("response_mode", "form_post");
  url.searchParams.set("scope", "openid email name");
  url.searchParams.set("state", state);
  url.searchParams.set("nonce", nonce);
  return url.toString();
}

export async function exchangeAppleCodeForIdToken(
  config: ApiConfig,
  code: string
): Promise<string> {
  if (!config.appleClientId || !config.appleRedirectUri) {
    throw new Error("APPLE_AUTH_NOT_CONFIGURED");
  }

  const response = await fetch("https://appleid.apple.com/auth/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      client_id: config.appleClientId,
      client_secret: createAppleClientSecret(config),
      code,
      grant_type: "authorization_code",
      redirect_uri: config.appleRedirectUri
    })
  });

  const payload = (await response.json().catch(() => null)) as AppleTokenResponse | null;
  if (!response.ok || !payload?.id_token) {
    throw new Error(payload?.error_description ?? payload?.error ?? "APPLE_TOKEN_EXCHANGE_FAILED");
  }

  return payload.id_token;
}

export function createAppleClientSecret(config: ApiConfig, now = new Date()): string {
  if (
    !config.appleClientId ||
    !config.appleTeamId ||
    !config.appleKeyId ||
    !config.applePrivateKey
  ) {
    throw new Error("APPLE_AUTH_NOT_CONFIGURED");
  }

  const issuedAt = Math.floor(now.getTime() / 1000);
  const expiresAt = issuedAt + 60 * 60;
  const encodedHeader = base64UrlEncodeJson({
    alg: "ES256",
    kid: config.appleKeyId,
    typ: "JWT"
  });
  const encodedPayload = base64UrlEncodeJson({
    iss: config.appleTeamId,
    iat: issuedAt,
    exp: expiresAt,
    aud: "https://appleid.apple.com",
    sub: config.appleClientId
  });
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signer = crypto.createSign("SHA256");
  signer.update(signingInput);
  signer.end();

  const signature = signer.sign({
    key: config.applePrivateKey,
    dsaEncoding: "ieee-p1363"
  });

  return `${signingInput}.${base64UrlEncode(signature)}`;
}

export async function verifyAppleIdToken(
  idToken: string,
  clientId: string,
  now = new Date()
): Promise<AppleIdTokenPayload | null> {
  const [encodedHeader, encodedPayload, encodedSignature] = idToken.split(".");
  if (!encodedHeader || !encodedPayload || !encodedSignature) {
    return null;
  }

  const header = parseJwtPart<AppleIdTokenHeader>(encodedHeader);
  const payload = parseJwtPart<AppleIdTokenPayload>(encodedPayload);
  if (!header || !payload || header.alg !== "RS256" || !header.kid) {
    return null;
  }

  const key = await findAppleJwk(header.kid);
  if (!key) {
    return null;
  }

  const verifier = crypto.createVerify("RSA-SHA256");
  verifier.update(`${encodedHeader}.${encodedPayload}`);
  verifier.end();

  const publicKey = crypto.createPublicKey({
    key,
    format: "jwk"
  });

  const signature = base64UrlDecode(encodedSignature);
  if (!verifier.verify(publicKey, signature)) {
    return null;
  }

  const expiresAt = payload.exp * 1000;
  if (
    payload.iss !== "https://appleid.apple.com" ||
    payload.aud !== clientId ||
    !payload.sub ||
    expiresAt <= now.getTime()
  ) {
    return null;
  }

  return payload;
}

export function isAppleEmailVerified(value: boolean | string | undefined): boolean {
  return value === true || value === "true";
}

async function findAppleJwk(kid: string): Promise<AppleJwk | null> {
  const response = await fetch("https://appleid.apple.com/auth/keys");
  if (!response.ok) {
    return null;
  }

  const payload = (await response.json().catch(() => null)) as AppleJwksResponse | null;
  return payload?.keys?.find((key) => key.kid === kid && key.kty === "RSA") ?? null;
}

function parseJwtPart<TPayload>(value: string): TPayload | null {
  try {
    return JSON.parse(base64UrlDecode(value).toString("utf8")) as TPayload;
  } catch {
    return null;
  }
}

function base64UrlEncodeJson(payload: unknown): string {
  return base64UrlEncode(Buffer.from(JSON.stringify(payload), "utf8"));
}

function base64UrlEncode(input: Buffer): string {
  return input.toString("base64url");
}

function base64UrlDecode(input: string): Buffer {
  return Buffer.from(input, "base64url");
}
