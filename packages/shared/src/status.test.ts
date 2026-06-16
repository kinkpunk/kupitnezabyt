import { describe, expect, it } from "vitest";

import { calculateNextCheckAt, getShoppingSyncAction } from "./status.js";

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
