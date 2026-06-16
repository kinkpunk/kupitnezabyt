import { describe, expect, it } from "vitest";

import { createUserDataExport, normalizeSearchQuery } from "./user-data.js";

describe("normalizeSearchQuery", () => {
  it("trims and collapses whitespace", () => {
    expect(normalizeSearchQuery("  кофе   молотый  ")).toBe("кофе молотый");
  });

  it("returns null for empty input", () => {
    expect(normalizeSearchQuery("   ")).toBeNull();
  });

  it("limits query length", () => {
    expect(normalizeSearchQuery("abcdef", 3)).toBe("abc");
  });
});

describe("createUserDataExport", () => {
  it("creates a stable export envelope", () => {
    expect(
      createUserDataExport({
        exportedAt: new Date("2026-06-16T20:00:00.000Z"),
        data: {
          user: {
            id: "user-1"
          },
          categories: []
        }
      })
    ).toEqual({
      schemaVersion: 1,
      exportedAt: "2026-06-16T20:00:00.000Z",
      data: {
        user: {
          id: "user-1"
        },
        categories: []
      }
    });
  });
});
