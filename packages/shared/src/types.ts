export const itemStatuses = [
  "IN_STOCK",
  "LOW",
  "NEED_BUY",
  "URGENT",
  "PAUSED"
] as const;

export type ItemStatus = (typeof itemStatuses)[number];

export const itemImportances = ["LOW", "NORMAL", "HIGH", "CRITICAL"] as const;

export type ItemImportance = (typeof itemImportances)[number];

export const shoppingPriorities = ["NORMAL", "URGENT"] as const;

export type ShoppingPriority = (typeof shoppingPriorities)[number];

export const categoryStatuses = ["OK", "ATTENTION", "NEED_BUY", "URGENT"] as const;

export type CategoryStatus = (typeof categoryStatuses)[number];

export const reminderTypes = [
  "ITEM_CHECK",
  "CATEGORY_CHECK",
  "GROUP_CHECK",
  "SHOPPING_REMINDER"
] as const;

export type ReminderType = (typeof reminderTypes)[number];

export const reminderStatuses = ["PENDING", "SENT", "FAILED", "CANCELLED"] as const;

export type ReminderStatus = (typeof reminderStatuses)[number];

export type ShoppingSyncAction =
  | {
      type: "UPSERT";
      priority: ShoppingPriority;
    }
  | {
      type: "COMPLETE_OPEN";
    }
  | {
      type: "NONE";
    };
