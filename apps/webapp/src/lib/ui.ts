import type { ItemImportance, ItemStatus } from "@kupitnezabyt/shared";
import type { CategoryStatus } from "@kupitnezabyt/shared";

import type { InAppReminder, WorkspaceSummary } from "./types";

export const statusLabels: Record<ItemStatus, string> = {
  IN_STOCK: "Есть",
  LOW: "Мало",
  NEED_BUY: "Купить",
  PAUSED: "Пауза"
};

export const statusOptions: ItemStatus[] = ["IN_STOCK", "LOW", "NEED_BUY"];

/** UI-level status used by the design-system components (StatusChip, tabs, badges). */
export type UiItemStatus = "ok" | "warn" | "bad";

export const uiStatusLabels: Record<UiItemStatus, string> = {
  ok: "Есть",
  warn: "Мало",
  bad: "Нет"
};

/** Cyclic order for the StatusChip tap interaction. */
export const uiStatusCycle: UiItemStatus[] = ["ok", "warn", "bad"];

export function itemStatusToUiStatus(status: ItemStatus): UiItemStatus | null {
  switch (status) {
    case "IN_STOCK":
      return "ok";
    case "LOW":
      return "warn";
    case "NEED_BUY":
      return "bad";
    case "PAUSED":
      return null;
    default:
      return null;
  }
}

export function nextUiStatus(status: UiItemStatus): UiItemStatus {
  const index = uiStatusCycle.indexOf(status);
  const next = uiStatusCycle[(index + 1) % uiStatusCycle.length];
  return next ?? status;
}

export function uiStatusToItemStatus(status: UiItemStatus): ItemStatus {
  switch (status) {
    case "ok":
      return "IN_STOCK";
    case "warn":
      return "LOW";
    case "bad":
      return "NEED_BUY";
  }
}

export const itemStatusBadgeClasses: Record<ItemStatus, string> = {
  IN_STOCK: "badge badge-success",
  LOW: "badge badge-warning",
  NEED_BUY: "badge badge-attention",
  PAUSED: "badge badge-muted"
};

export const importanceLabels: Record<ItemImportance, string> = {
  LOW: "Низкая важность",
  NORMAL: "Обычная важность",
  HIGH: "Высокая важность",
  CRITICAL: "Критическая важность"
};

export const importanceOptions: ItemImportance[] = ["LOW", "NORMAL", "HIGH", "CRITICAL"];

export const importanceBadgeClasses: Record<Exclude<ItemImportance, "NORMAL">, string> = {
  LOW: "badge badge-muted",
  HIGH: "badge badge-warning",
  CRITICAL: "badge badge-urgent"
};

export const categoryStatusLabels: Record<CategoryStatus, string> = {
  OK: "OK",
  ATTENTION: "Мало",
  NEED_BUY: "Купить"
};

export const categoryTriggerItemStatus: Record<CategoryStatus, ItemStatus | null> = {
  OK: null,
  ATTENTION: "LOW",
  NEED_BUY: "NEED_BUY"
};

export const workspaceRoleLabels: Record<WorkspaceSummary["role"], string> = {
  OWNER: "Владелец",
  EDITOR: "Редактор",
  VIEWER: "Просмотр"
};

export const reminderEntityLabels: Record<InAppReminder["entityType"], string> = {
  CATEGORY: "Категория",
  GROUP: "Набор",
  ITEM: "Товар"
};


export const onboardingStorageKey = "kupitnezabyt.onboarding.completed";
export const themeStorageKey = "kupitnezabyt.theme";
export const reminderSnoozeDays = 3;

export const starterCategories = ["Еда", "Аптека", "Косметика", "Бытовая химия", "Дом"];
export const starterItemHints = ["Кофе", "Ибупрофен", "Шампунь", "Стиральный порошок", "Рис"];

export type ThemeMode = "dark" | "light" | "system";

export const themeModeLabels: Record<ThemeMode, string> = {
  system: "Тема: как на устройстве",
  light: "Тема: светлая",
  dark: "Тема: тёмная"
};
