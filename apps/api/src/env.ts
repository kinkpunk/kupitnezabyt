export type ApiConfig = {
  appBaseUrl: string;
  jwtSecret: string;
  nodeEnv: string;
  devAuthEnabled: boolean;
  telegramBotToken: string | undefined;
  port: number;
};

export function getConfig(): ApiConfig {
  return {
    appBaseUrl: process.env.APP_BASE_URL ?? "http://localhost:3000",
    jwtSecret: process.env.JWT_SECRET ?? "replace_me",
    nodeEnv: process.env.NODE_ENV ?? "development",
    devAuthEnabled: process.env.DEV_AUTH_ENABLED === "true",
    telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || undefined,
    port: Number(process.env.API_PORT ?? 3001)
  };
}
