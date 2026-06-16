import { Bot, InlineKeyboard } from "grammy";

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

  return bot;
}

function appKeyboard(webAppUrl: string): InlineKeyboard {
  return new InlineKeyboard().webApp("Открыть kupitnezabyt", webAppUrl);
}
