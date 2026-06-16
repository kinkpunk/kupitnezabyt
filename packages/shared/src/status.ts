import type { ItemStatus, ShoppingSyncAction } from "./types.js";

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
