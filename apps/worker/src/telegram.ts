import type { NotificationMessage } from "@kupitnezabyt/shared";

type TelegramInlineKeyboardButton = {
  text: string;
  callback_data?: string;
  web_app?: {
    url: string;
  };
};

type TelegramSendMessageResponse =
  | {
      ok: true;
    }
  | {
      ok: false;
      description?: string;
    };

export async function sendTelegramMessage(input: {
  botToken: string;
  chatId: string;
  message: NotificationMessage;
}): Promise<void> {
  const response = await fetch(`https://api.telegram.org/bot${input.botToken}/sendMessage`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      chat_id: input.chatId,
      text: input.message.text,
      reply_markup: {
        inline_keyboard: input.message.buttons.map((row) =>
          row.map((button): TelegramInlineKeyboardButton => {
            if (button.webAppUrl) {
              return {
                text: button.text,
                web_app: {
                  url: button.webAppUrl
                }
              };
            }

            if (!button.callbackData) {
              throw new Error("TELEGRAM_BUTTON_CALLBACK_DATA_REQUIRED");
            }

            return {
              text: button.text,
              callback_data: button.callbackData
            };
          })
        )
      }
    })
  });

  const payload = (await response.json().catch(() => null)) as TelegramSendMessageResponse | null;
  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.ok === false ? payload.description ?? "TELEGRAM_SEND_FAILED" : "TELEGRAM_SEND_FAILED");
  }
}
