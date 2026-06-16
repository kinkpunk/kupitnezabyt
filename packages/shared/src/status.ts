import type { CategoryStatus, ItemStatus, ShoppingSyncAction } from "./types.js";

const millisecondsInDay = 24 * 60 * 60 * 1000;

export function isItemStatus(value: string): value is ItemStatus {
  return (
    value === "IN_STOCK" ||
    value === "LOW" ||
    value === "NEED_BUY" ||
    value === "URGENT" ||
    value === "PAUSED"
  );
}

export function calculateNextCheckAt(
  status: ItemStatus,
  now: Date,
  usageCycleDays?: number | null
): Date | null {
  if (status === "LOW") {
    return new Date(now.getTime() + 3 * millisecondsInDay);
  }

  if (status === "IN_STOCK" && usageCycleDays && usageCycleDays > 0) {
    return new Date(now.getTime() + usageCycleDays * millisecondsInDay);
  }

  return null;
}

export function getShoppingSyncAction(status: ItemStatus): ShoppingSyncAction {
  if (status === "NEED_BUY") {
    return {
      type: "UPSERT",
      priority: "NORMAL"
    };
  }

  if (status === "URGENT") {
    return {
      type: "UPSERT",
      priority: "URGENT"
    };
  }

  if (status === "IN_STOCK" || status === "LOW" || status === "PAUSED") {
    return {
      type: "COMPLETE_OPEN"
    };
  }

  return {
    type: "NONE"
  };
}

export type StatusItem = {
  status: ItemStatus;
  archivedAt?: Date | string | null;
};

export function aggregateCategoryStatus(items: readonly StatusItem[]): CategoryStatus {
  const activeItems = items.filter(
    (item) => item.archivedAt === undefined || item.archivedAt === null
  );

  if (activeItems.some((item) => item.status === "URGENT")) {
    return "URGENT";
  }

  if (activeItems.some((item) => item.status === "NEED_BUY")) {
    return "NEED_BUY";
  }

  if (activeItems.some((item) => item.status === "LOW")) {
    return "ATTENTION";
  }

  return "OK";
}

export function calculateReadiness(items: readonly StatusItem[]): number | null {
  const activeTrackedItems = items.filter(
    (item) =>
      (item.archivedAt === undefined || item.archivedAt === null) && item.status !== "PAUSED"
  );

  if (activeTrackedItems.length === 0) {
    return null;
  }

  const inStockCount = activeTrackedItems.filter((item) => item.status === "IN_STOCK").length;
  return Math.round((inStockCount / activeTrackedItems.length) * 100);
}
