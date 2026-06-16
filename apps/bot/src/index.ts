import { createBot } from "./bot.js";
import { getBotConfig } from "./config.js";

const config = getBotConfig();
const bot = createBot(config);

bot.catch((error) => {
  console.error("Bot update failed", error.error);
});

await bot.start({
  drop_pending_updates: config.nodeEnv === "development"
});
