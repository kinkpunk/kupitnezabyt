import { describe, expect, it } from "vitest";

import type { Category, Item } from "./types";
import {
  findCategoryWithStatus,
  itemStatusToUiStatus,
  nextUiStatus,
  resolveStarterItemCategories
} from "./ui";

describe("itemStatusToUiStatus", () => {
  it("maps IN_STOCK to ok", () => {
    expect(itemStatusToUiStatus("IN_STOCK")).toBe("ok");
  });

  it("maps LOW to warn", () => {
    expect(itemStatusToUiStatus("LOW")).toBe("warn");
  });

  it("maps NEED_BUY to bad", () => {
    expect(itemStatusToUiStatus("NEED_BUY")).toBe("bad");
  });

  it("maps PAUSED to null", () => {
    expect(itemStatusToUiStatus("PAUSED")).toBeNull();
  });
});

describe("nextUiStatus", () => {
  it("cycles ok -> warn -> bad -> ok", () => {
    expect(nextUiStatus("ok")).toBe("warn");
    expect(nextUiStatus("warn")).toBe("bad");
    expect(nextUiStatus("bad")).toBe("ok");
  });
});

describe("resolveStarterItemCategories", () => {
  const starterItems = [
    { name: "Кофе", categoryName: "Еда" },
    { name: "Ибупрофен", categoryName: "Аптека" },
    { name: "Шампунь", categoryName: "Косметика" }
  ];

  it("keeps preferred categories when they are available", () => {
    expect(
      resolveStarterItemCategories(starterItems, ["Еда", "Аптека", "Косметика"])
    ).toEqual([
      { name: "Кофе", categoryName: "Еда" },
      { name: "Ибупрофен", categoryName: "Аптека" },
      { name: "Шампунь", categoryName: "Косметика" }
    ]);
  });

  it("spreads items across chosen categories when preferred ones are missing", () => {
    expect(resolveStarterItemCategories(starterItems, ["Дом", "Бытовая химия"])).toEqual([
      { name: "Кофе", categoryName: "Дом" },
      { name: "Ибупрофен", categoryName: "Бытовая химия" },
      { name: "Шампунь", categoryName: "Дом" }
    ]);
  });

  it("reuses a preferred category for duplicate mappings", () => {
    const items = [
      { name: "Кофе", categoryName: "Еда" },
      { name: "Рис", categoryName: "Еда" }
    ];
    expect(resolveStarterItemCategories(items, ["Еда", "Дом"])).toEqual([
      { name: "Кофе", categoryName: "Еда" },
      { name: "Рис", categoryName: "Дом" }
    ]);
  });

  it("returns items unchanged when no options are available", () => {
    expect(resolveStarterItemCategories(starterItems, [])).toEqual(starterItems);
  });
});

describe("findCategoryWithStatus", () => {
  const categories: Category[] = [
    {
      id: "cat-1",
      name: "Еда",
      icon: null,
      sortOrder: 0,
      usageCycleDays: null,
      nextCheckAt: null,
      reminderEnabled: false,
      archivedAt: null,
      itemCount: 1,
      aggregateStatus: "OK"
    },
    {
      id: "cat-2",
      name: "Дом",
      icon: null,
      sortOrder: 1,
      usageCycleDays: null,
      nextCheckAt: null,
      reminderEnabled: false,
      archivedAt: null,
      itemCount: 1,
      aggregateStatus: "ATTENTION"
    }
  ];

  const itemWithStatus = (categoryId: string, status: Item["status"]): Item => ({
    id: `item-${categoryId}-${status}`,
    userId: "u1",
    categoryId,
    name: "Товар",
    brand: null,
    notes: null,
    status,
    importance: "NORMAL",
    usageCycleDays: null,
    reminderEnabled: false,
    sortOrder: 0,
    lastCheckedAt: null,
    lastBoughtAt: null,
    nextCheckAt: null,
    archivedAt: null
  });

  it("returns the first category containing an item with the status", () => {
    const items = [itemWithStatus("cat-2", "LOW"), itemWithStatus("cat-1", "LOW")];
    expect(findCategoryWithStatus(categories, items, "LOW")?.id).toBe("cat-1");
  });

  it("returns null when no category has an item with the status", () => {
    const items = [itemWithStatus("cat-1", "IN_STOCK")];
    expect(findCategoryWithStatus(categories, items, "NEED_BUY")).toBeNull();
  });
});
