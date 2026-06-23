export type ApiConfig = {
  appBaseUrl: string;
  emailFrom: string | undefined;
  emailProviderApiKey: string | undefined;
  jwtSecret: string;
  magicLinkTokenTtlMinutes: number;
  nodeEnv: string;
  devAuthEnabled: boolean;
  googleClientId: string | undefined;
  googleClientSecret: string | undefined;
  googleRedirectUri: string | undefined;
  appleClientId: string | undefined;
  appleTeamId: string | undefined;
  appleKeyId: string | undefined;
  applePrivateKey: string | undefined;
  appleRedirectUri: string | undefined;
  telegramBotToken: string | undefined;
  port: number;
};

export function getConfig(): ApiConfig {
  const config = {
    appBaseUrl: process.env.APP_BASE_URL ?? "http://localhost:3000",
    emailFrom: process.env.EMAIL_FROM || undefined,
    emailProviderApiKey: process.env.EMAIL_PROVIDER_API_KEY || undefined,
    jwtSecret: process.env.JWT_SECRET ?? "replace_me",
    magicLinkTokenTtlMinutes: readPositiveInteger(
      process.env.MAGIC_LINK_TOKEN_TTL_MINUTES,
      15
    ),
    nodeEnv: process.env.NODE_ENV ?? "development",
    devAuthEnabled: process.env.DEV_AUTH_ENABLED === "true",
    googleClientId: process.env.GOOGLE_CLIENT_ID || undefined,
    googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || undefined,
    googleRedirectUri: process.env.GOOGLE_REDIRECT_URI || undefined,
    appleClientId: process.env.APPLE_CLIENT_ID || undefined,
    appleTeamId: process.env.APPLE_TEAM_ID || undefined,
    appleKeyId: process.env.APPLE_KEY_ID || undefined,
    applePrivateKey: normalizeMultilineEnv(process.env.APPLE_PRIVATE_KEY),
    appleRedirectUri: process.env.APPLE_REDIRECT_URI || undefined,
    telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || undefined,
    port: Number(process.env.API_PORT ?? 3001)
  };

  assertProductionConfig(config);

  return config;
}

function readPositiveInteger(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeMultilineEnv(value: string | undefined): string | undefined {
  return value ? value.replaceAll("\\n", "\n") : undefined;
}

function assertProductionConfig(config: ApiConfig): void {
  if (config.nodeEnv !== "production") {
    return;
  }

  const missing: string[] = [];

  if (!config.jwtSecret || config.jwtSecret === "replace_me") {
    missing.push("JWT_SECRET");
  }

  if (!config.emailFrom) {
    missing.push("EMAIL_FROM");
  }

  if (!config.emailProviderApiKey) {
    missing.push("EMAIL_PROVIDER_API_KEY");
  }

  if (!config.appBaseUrl.startsWith("https://")) {
    missing.push("APP_BASE_URL_HTTPS");
  }

  if (missing.length) {
    throw new Error(`PRODUCTION_CONFIG_INVALID: ${missing.join(", ")}`);
  }
}
