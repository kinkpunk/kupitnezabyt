export type BotConfig = {
  token: string;
  webAppUrl: string;
  nodeEnv: string;
};

export function getBotConfig(): BotConfig {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN is required to start the bot.");
  }

  return {
    token,
    webAppUrl: process.env.TELEGRAM_WEBAPP_URL ?? "http://localhost:3000",
    nodeEnv: process.env.NODE_ENV ?? "development"
  };
}
