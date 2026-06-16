import { prisma } from "@kupitnezabyt/database";
import { renderItemCheckNotification } from "@kupitnezabyt/shared";

import type { WorkerConfig } from "./config.js";
import { sendTelegramMessage } from "./telegram.js";

const millisecondsInMinute = 60 * 1000;

export async function processDueReminders(config: WorkerConfig, now = new Date()): Promise<number> {
  const reminders = await prisma.reminder.findMany({
    where: {
      status: "PENDING",
      scheduledFor: {
        lte: now
      }
    },
    include: {
      item: true,
      user: true
    },
    orderBy: {
      scheduledFor: "asc"
    },
    take: config.reminderBatchSize
  });

  let processedCount = 0;

  for (const reminder of reminders) {
    if (reminder.type !== "ITEM_CHECK" || !reminder.item || reminder.item.archivedAt) {
      await prisma.reminder.update({
        where: {
          id: reminder.id
        },
        data: {
          status: "CANCELLED"
        }
      });
      processedCount += 1;
      continue;
    }

    if (!reminder.item.reminderEnabled || reminder.item.status === "PAUSED") {
      await prisma.reminder.update({
        where: {
          id: reminder.id
        },
        data: {
          status: "CANCELLED"
        }
      });
      processedCount += 1;
      continue;
    }

    try {
      await sendTelegramMessage({
        botToken: config.telegramBotToken,
        chatId: reminder.user.telegramUserId,
        message: renderItemCheckNotification({
          itemId: reminder.item.id,
          itemName: reminder.item.name,
          webAppUrl: config.webAppUrl
        })
      });

      await prisma.reminder.update({
        where: {
          id: reminder.id
        },
        data: {
          status: "SENT",
          sentAt: now
        }
      });
    } catch {
      await recordReminderFailure(reminder.id, reminder.attemptCount, config.maxAttempts, now);
    }

    processedCount += 1;
  }

  return processedCount;
}

export async function runReminderLoop(config: WorkerConfig): Promise<void> {
  await processDueReminders(config);

  setInterval(() => {
    void processDueReminders(config).catch((error) => {
      console.error("Reminder polling failed", error);
    });
  }, config.pollIntervalMs);
}

async function recordReminderFailure(
  reminderId: string,
  attemptCount: number,
  maxAttempts: number,
  now: Date
): Promise<void> {
  const nextAttemptCount = attemptCount + 1;
  if (nextAttemptCount >= maxAttempts) {
    await prisma.reminder.update({
      where: {
        id: reminderId
      },
      data: {
        status: "FAILED",
        attemptCount: nextAttemptCount
      }
    });
    return;
  }

  await prisma.reminder.update({
    where: {
      id: reminderId
    },
    data: {
      attemptCount: nextAttemptCount,
      scheduledFor: new Date(now.getTime() + nextAttemptCount * millisecondsInMinute)
    }
  });
}
