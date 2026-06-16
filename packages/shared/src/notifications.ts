import type { ItemStatus } from "./types.js";

export type ItemReminderNotification = {
  itemId: string;
  itemName: string;
  webAppUrl: string;
};

export type NotificationButton = {
  text: string;
  callbackData?: string;
  webAppUrl?: string;
};

export type NotificationMessage = {
  text: string;
  buttons: NotificationButton[][];
};

export type ItemReminderAction =
  | {
      type: "SET_STATUS";
      itemId: string;
      status: ItemStatus;
    }
  | {
      type: "SNOOZE";
      itemId: string;
      days: number;
    };

export function renderItemCheckNotification(
  input: ItemReminderNotification
): NotificationMessage {
  return {
    text: `Проверь, не заканчивается ли ${input.itemName}.`,
    buttons: [
      [
        statusButton("Есть", input.itemId, "IN_STOCK"),
        statusButton("Мало", input.itemId, "LOW")
      ],
      [
        statusButton("Купить", input.itemId, "NEED_BUY"),
        statusButton("Срочно", input.itemId, "URGENT")
      ],
      [
        {
          text: "Позже",
          callbackData: createItemReminderSnoozeCallbackData(input.itemId, 3)
        },
        {
          text: "Открыть",
          webAppUrl: input.webAppUrl
        }
      ]
    ]
  };
}

export function createItemStatusCallbackData(itemId: string, status: ItemStatus): string {
  return `item_status:${itemId}:${status}`;
}

export function createItemReminderSnoozeCallbackData(itemId: string, days: number): string {
  return `item_snooze:${itemId}:${days}`;
}

export function parseItemReminderCallbackData(value: string): ItemReminderAction | null {
  const [action, itemId, rawValue] = value.split(":");

  if (!itemId || !rawValue) {
    return null;
  }

  if (action === "item_status" && isCallbackStatus(rawValue)) {
    return {
      type: "SET_STATUS",
      itemId,
      status: rawValue
    };
  }

  if (action === "item_snooze") {
    const days = Number(rawValue);
    if (Number.isInteger(days) && days > 0) {
      return {
        type: "SNOOZE",
        itemId,
        days
      };
    }
  }

  return null;
}

function statusButton(text: string, itemId: string, status: ItemStatus): NotificationButton {
  return {
    text,
    callbackData: createItemStatusCallbackData(itemId, status)
  };
}

function isCallbackStatus(value: string): value is ItemStatus {
  return (
    value === "IN_STOCK" ||
    value === "LOW" ||
    value === "NEED_BUY" ||
    value === "URGENT" ||
    value === "PAUSED"
  );
}
