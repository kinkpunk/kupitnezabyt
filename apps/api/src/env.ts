export type ApiConfig = {
  appBaseUrl: string;
  emailFrom: string | undefined;
  emailProviderApiKey: string | undefined;
  jwtSecret: string;
  magicLinkTokenTtlMinutes: number;
  nodeEnv: string;
  devAuthEnabled: boolean;
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
