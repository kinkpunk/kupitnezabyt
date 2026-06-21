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
  return {
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
}

function readPositiveInteger(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
