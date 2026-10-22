import { describe, expect, it } from "vitest";

import { itemStatusToUiStatus, nextUiStatus, resolveStarterItemCategories } from "./ui";

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
