import { Bot, InlineKeyboard } from "grammy";
import {
  cancelPendingItemCheckReminders,
  prisma,
  setItemStatus,
  upsertItemCheckReminder
} from "@kupitnezabyt/database";
import {
  calculateSnoozedUntil,
  parseItemReminderCallbackData
} from "@kupitnezabyt/shared";

import type { BotConfig } from "./config.js";

export function createBot(config: BotConfig): Bot {
  const bot = new Bot(config.token);

  bot.command("start", async (ctx) => {
    await ctx.reply(
      "kupitnezabyt помогает помнить о товарах, которые регулярно заканчиваются.",
      {
        reply_markup: appKeyboard(config.webAppUrl)
      }
    );
  });

  bot.command("app", async (ctx) => {
    await ctx.reply("Открыть Mini App:", {
      reply_markup: appKeyboard(config.webAppUrl)
    });
  });

  bot.command("help", async (ctx) => {
    await ctx.reply(
      [
        "/app - открыть Mini App",
        "/help - показать помощь",
        "",
        "Напоминания и быстрые действия появятся в следующих срезах."
      ].join("\n")
    );
  });

  bot.on("callback_query:data", async (ctx) => {
    const action = parseItemReminderCallbackData(ctx.callbackQuery.data);
    if (!action) {
      await ctx.answerCallbackQuery({
        text: "Действие устарело или не поддерживается."
      });
      return;
    }

    const user = await prisma.user.findUnique({
      where: {
        telegramUserId: String(ctx.from.id)
      }
    });

    if (!user) {
      await ctx.answerCallbackQuery({
        text: "Сначала откройте Mini App."
      });
      return;
    }

    try {
      if (action.type === "SET_STATUS") {
        await prisma.$transaction((tx) =>
          setItemStatus(tx, user.id, action.itemId, action.status)
        );
        await ctx.answerCallbackQuery({
          text: "Статус обновлен."
        });
        return;
      }

      const nextCheckAt = calculateSnoozedUntil(new Date(), action.days);
      await prisma.$transaction(async (tx) => {
        const item = await tx.item.findFirst({
          where: {
            id: action.itemId,
            userId: user.id,
            archivedAt: null
          }
        });

        if (!item || !item.reminderEnabled || item.status === "PAUSED") {
          throw new Error("REMINDER_NOT_AVAILABLE");
        }

        await cancelPendingItemCheckReminders(tx, user.id, item.id);
        await upsertItemCheckReminder(tx, {
          userId: user.id,
          itemId: item.id,
          scheduledFor: nextCheckAt
        });

        await tx.item.update({
          where: {
            id: item.id
          },
          data: {
            nextCheckAt
          }
        });
      });

      await ctx.answerCallbackQuery({
        text: "Напомню позже."
      });
    } catch {
      await ctx.answerCallbackQuery({
        text: "Не удалось выполнить действие."
      });
    }
  });

  return bot;
}

function appKeyboard(webAppUrl: string): InlineKeyboard {
  return new InlineKeyboard().webApp("Открыть kupitnezabyt", webAppUrl);
}
