export type WorkerConfig = {
  telegramBotToken: string;
  webAppUrl: string;
  pollIntervalMs: number;
  reminderBatchSize: number;
  maxAttempts: number;
};

export function getWorkerConfig(): WorkerConfig {
  const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!telegramBotToken) {
    throw new Error("TELEGRAM_BOT_TOKEN is required to start the worker.");
  }

  return {
    telegramBotToken,
    webAppUrl: process.env.TELEGRAM_WEBAPP_URL ?? "http://localhost:3000",
    pollIntervalMs: readPositiveInteger(process.env.WORKER_POLL_INTERVAL_MS, 5 * 60 * 1000),
    reminderBatchSize: readPositiveInteger(process.env.REMINDER_BATCH_SIZE, 25),
    maxAttempts: readPositiveInteger(process.env.REMINDER_MAX_ATTEMPTS, 5)
  };
}

function readPositiveInteger(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
