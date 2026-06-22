import crypto from "node:crypto";

import type { ApiConfig } from "./env.js";

type GoogleTokenResponse = {
  id_token?: string;
  error?: string;
  error_description?: string;
};

type GoogleJwk = {
  kid: string;
  kty: string;
  alg?: string;
  use?: string;
  n: string;
  e: string;
};

type GoogleJwksResponse = {
  keys?: GoogleJwk[];
};

type GoogleIdTokenHeader = {
  alg: string;
  kid: string;
};

export type GoogleIdTokenPayload = {
  iss: string;
  aud: string;
  exp: number;
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  nonce?: string;
};

export function isGoogleAuthConfigured(config: ApiConfig): boolean {
  return Boolean(config.googleClientId && config.googleClientSecret && config.googleRedirectUri);
}

export function createGoogleAuthorizationUrl(
  config: ApiConfig,
  state: string,
  nonce: string
): string {
  if (!config.googleClientId || !config.googleRedirectUri) {
    throw new Error("GOOGLE_AUTH_NOT_CONFIGURED");
  }

  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", config.googleClientId);
  url.searchParams.set("redirect_uri", config.googleRedirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", state);
  url.searchParams.set("nonce", nonce);
  url.searchParams.set("prompt", "select_account");
  return url.toString();
}

export async function exchangeGoogleCodeForIdToken(
  config: ApiConfig,
  code: string
): Promise<string> {
  if (!config.googleClientId || !config.googleClientSecret || !config.googleRedirectUri) {
    throw new Error("GOOGLE_AUTH_NOT_CONFIGURED");
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      client_id: config.googleClientId,
      client_secret: config.googleClientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: config.googleRedirectUri
    })
  });

  const payload = (await response.json().catch(() => null)) as GoogleTokenResponse | null;
  if (!response.ok || !payload?.id_token) {
    throw new Error(payload?.error_description ?? payload?.error ?? "GOOGLE_TOKEN_EXCHANGE_FAILED");
  }

  return payload.id_token;
}

export async function verifyGoogleIdToken(
  idToken: string,
  clientId: string,
  now = new Date()
): Promise<GoogleIdTokenPayload | null> {
  const [encodedHeader, encodedPayload, encodedSignature] = idToken.split(".");
  if (!encodedHeader || !encodedPayload || !encodedSignature) {
    return null;
  }

  const header = parseJwtPart<GoogleIdTokenHeader>(encodedHeader);
  const payload = parseJwtPart<GoogleIdTokenPayload>(encodedPayload);
  if (!header || !payload || header.alg !== "RS256" || !header.kid) {
    return null;
  }

  const key = await findGoogleJwk(header.kid);
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

  const issuerOk = payload.iss === "https://accounts.google.com" || payload.iss === "accounts.google.com";
  const expiresAt = payload.exp * 1000;
  if (!issuerOk || payload.aud !== clientId || !payload.sub || expiresAt <= now.getTime()) {
    return null;
  }

  return payload;
}

async function findGoogleJwk(kid: string): Promise<GoogleJwk | null> {
  const response = await fetch("https://www.googleapis.com/oauth2/v3/certs");
  if (!response.ok) {
    return null;
  }

  const payload = (await response.json().catch(() => null)) as GoogleJwksResponse | null;
  return payload?.keys?.find((key) => key.kid === kid && key.kty === "RSA") ?? null;
}

function parseJwtPart<TPayload>(value: string): TPayload | null {
  try {
    return JSON.parse(base64UrlDecode(value).toString("utf8")) as TPayload;
  } catch {
    return null;
  }
}

function base64UrlDecode(input: string): Buffer {
  const padded = input.padEnd(input.length + ((4 - (input.length % 4)) % 4), "=");
  return Buffer.from(padded.replaceAll("-", "+").replaceAll("_", "/"), "base64");
}
