import type { ItemImportance, ItemStatus } from "@kupitnezabyt/shared";
import type { CategoryStatus } from "@kupitnezabyt/shared";

import type { InAppReminder, WorkspaceSummary } from "./types";

export const statusLabels: Record<ItemStatus, string> = {
  IN_STOCK: "Есть",
  LOW: "Мало",
  NEED_BUY: "Купить",
  URGENT: "Срочно",
  PAUSED: "Пауза"
};

export const statusOptions: ItemStatus[] = ["IN_STOCK", "LOW", "NEED_BUY", "URGENT"];

export const itemStatusBadgeClasses: Record<ItemStatus, string> = {
  IN_STOCK: "badge badge-success",
  LOW: "badge badge-warning",
  NEED_BUY: "badge badge-attention",
  URGENT: "badge badge-urgent",
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
  NEED_BUY: "Купить",
  URGENT: "Срочно"
};

export const categoryTriggerItemStatus: Record<CategoryStatus, ItemStatus | null> = {
  OK: null,
  ATTENTION: "LOW",
  NEED_BUY: "NEED_BUY",
  URGENT: "URGENT"
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

export function formatPositionCount(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;

  if (mod10 === 1 && mod100 !== 11) {
    return `${count} позиция`;
  }

  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return `${count} позиции`;
  }

  return `${count} позиций`;
}

export function formatReminderCount(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;

  if (mod10 === 1 && mod100 !== 11) {
    return `${count} напоминание`;
  }

  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return `${count} напоминания`;
  }

  return `${count} напоминаний`;
}

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
