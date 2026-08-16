import { describe, expect, it } from "vitest";

import {
  aggregateCategoryStatus,
  calculateNextCheckAt,
  calculateReadiness,
  getShoppingSyncAction,
  sortItemsByStatus,
  type SortableItem
} from "./status.js";

describe("calculateNextCheckAt", () => {
  const now = new Date("2026-06-16T12:00:00.000Z");

  it("uses the item cycle for IN_STOCK", () => {
    expect(calculateNextCheckAt("IN_STOCK", now, 10)?.toISOString()).toBe(
      "2026-06-26T12:00:00.000Z"
    );
  });

  it("does not schedule IN_STOCK without a cycle", () => {
    expect(calculateNextCheckAt("IN_STOCK", now, null)).toBeNull();
  });

  it("schedules LOW three days later", () => {
    expect(calculateNextCheckAt("LOW", now, 30)?.toISOString()).toBe(
      "2026-06-19T12:00:00.000Z"
    );
  });

  it("does not schedule buy or paused statuses", () => {
    expect(calculateNextCheckAt("NEED_BUY", now, 30)).toBeNull();
    expect(calculateNextCheckAt("URGENT", now, 30)).toBeNull();
    expect(calculateNextCheckAt("PAUSED", now, 30)).toBeNull();
  });
});

describe("getShoppingSyncAction", () => {
  it("upserts normal shopping entries for NEED_BUY", () => {
    expect(getShoppingSyncAction("NEED_BUY")).toEqual({
      type: "UPSERT",
      priority: "NORMAL"
    });
  });

  it("upserts urgent shopping entries for URGENT", () => {
    expect(getShoppingSyncAction("URGENT")).toEqual({
      type: "UPSERT",
      priority: "URGENT"
    });
  });

  it("completes open shopping entries for non-buy statuses", () => {
    expect(getShoppingSyncAction("IN_STOCK")).toEqual({
      type: "COMPLETE_OPEN"
    });
    expect(getShoppingSyncAction("LOW")).toEqual({
      type: "COMPLETE_OPEN"
    });
    expect(getShoppingSyncAction("PAUSED")).toEqual({
      type: "COMPLETE_OPEN"
    });
  });
});

describe("aggregateCategoryStatus", () => {
  it("returns URGENT when any active item is urgent", () => {
    expect(
      aggregateCategoryStatus([
        { status: "IN_STOCK" },
        { status: "URGENT" },
        { status: "NEED_BUY" }
      ])
    ).toBe("URGENT");
  });

  it("returns NEED_BUY before LOW", () => {
    expect(
      aggregateCategoryStatus([
        { status: "LOW" },
        { status: "NEED_BUY" }
      ])
    ).toBe("NEED_BUY");
  });

  it("returns ATTENTION for LOW items", () => {
    expect(
      aggregateCategoryStatus([
        { status: "IN_STOCK" },
        { status: "LOW" }
      ])
    ).toBe("ATTENTION");
  });

  it("ignores archived items", () => {
    expect(
      aggregateCategoryStatus([
        { status: "URGENT", archivedAt: new Date("2026-06-16T00:00:00.000Z") },
        { status: "IN_STOCK" }
      ])
    ).toBe("OK");
  });
});

describe("calculateReadiness", () => {
  it("returns the percent of active non-paused items in stock", () => {
    expect(
      calculateReadiness([
        { status: "IN_STOCK" },
        { status: "LOW" },
        { status: "PAUSED" },
        { status: "IN_STOCK" }
      ])
    ).toBe(67);
  });

  it("returns null when there are no active tracked items", () => {
    expect(calculateReadiness([{ status: "PAUSED" }])).toBeNull();
  });
});

describe("sortItemsByStatus", () => {
  it("orders items by status urgency, then sortOrder, then createdAt", () => {
    const items: SortableItem[] = [
      { status: "IN_STOCK", sortOrder: 0, createdAt: "2026-08-15T10:00:00.000Z" },
      { status: "URGENT", sortOrder: 2, createdAt: "2026-08-15T10:00:00.000Z" },
      { status: "LOW", sortOrder: 0, createdAt: "2026-08-15T10:00:00.000Z" },
      { status: "NEED_BUY", sortOrder: 1, createdAt: "2026-08-15T10:00:00.000Z" },
      { status: "PAUSED", sortOrder: 0, createdAt: "2026-08-15T10:00:00.000Z" }
    ];

    const sorted = sortItemsByStatus(items);

    expect(sorted.map((item) => item.status)).toEqual([
      "URGENT",
      "NEED_BUY",
      "LOW",
      "IN_STOCK",
      "PAUSED"
    ]);
  });

  it("falls back to sortOrder and createdAt within the same status", () => {
    const items: SortableItem[] = [
      { status: "IN_STOCK", sortOrder: 2, createdAt: "2026-08-15T12:00:00.000Z" },
      { status: "IN_STOCK", sortOrder: 1, createdAt: "2026-08-15T13:00:00.000Z" },
      { status: "IN_STOCK", sortOrder: 1, createdAt: "2026-08-15T11:00:00.000Z" }
    ];

    const sorted = sortItemsByStatus(items);

    expect(sorted.map((item) => item.sortOrder)).toEqual([1, 1, 2]);
    expect(sorted.map((item) => new Date(item.createdAt).getUTCHours())).toEqual([11, 13, 12]);
  });
});
