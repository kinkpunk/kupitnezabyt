import { describe, expect, it } from "vitest";

import {
  parseItemReminderCallbackData,
  renderItemCheckNotification
} from "./notifications.js";

describe("renderItemCheckNotification", () => {
  it("renders item reminder text and actions", () => {
    const notification = renderItemCheckNotification({
      itemId: "item-1",
      itemName: "кофе",
      webAppUrl: "https://example.com"
    });

    expect(notification.text).toContain("кофе");
    expect(notification.buttons.flat().map((button) => button.text)).toEqual([
      "Есть",
      "Мало",
      "Купить",
      "Срочно",
      "Позже",
      "Открыть"
    ]);
  });
});

describe("parseItemReminderCallbackData", () => {
  it("parses status callbacks", () => {
    expect(parseItemReminderCallbackData("item_status:item-1:LOW")).toEqual({
      type: "SET_STATUS",
      itemId: "item-1",
      status: "LOW"
    });
  });

  it("parses snooze callbacks", () => {
    expect(parseItemReminderCallbackData("item_snooze:item-1:3")).toEqual({
      type: "SNOOZE",
      itemId: "item-1",
      days: 3
    });
  });

  it("rejects invalid callbacks", () => {
    expect(parseItemReminderCallbackData("item_status:item-1:NOPE")).toBeNull();
    expect(parseItemReminderCallbackData("item_snooze:item-1:0")).toBeNull();
  });
});
