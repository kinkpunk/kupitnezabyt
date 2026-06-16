import { describe, expect, it } from "vitest";

import {
  calculateSnoozedUntil,
  createReminderIdempotencyKey,
  getDueReminderCandidates
} from "./reminders.js";

describe("calculateSnoozedUntil", () => {
  const now = new Date("2026-06-16T12:00:00.000Z");

  it("adds a whole number of days", () => {
    expect(calculateSnoozedUntil(now, 3).toISOString()).toBe("2026-06-19T12:00:00.000Z");
  });

  it("rejects non-positive day counts", () => {
    expect(() => calculateSnoozedUntil(now, 0)).toThrow("SNOOZE_DAYS_INVALID");
  });
});

describe("getDueReminderCandidates", () => {
  const now = new Date("2026-06-16T12:00:00.000Z");

  it("returns pending due reminders sorted by scheduled time", () => {
    expect(
      getDueReminderCandidates(
        [
          {
            id: "later",
            scheduledFor: new Date("2026-06-17T12:00:00.000Z"),
            status: "PENDING"
          },
          {
            id: "sent",
            scheduledFor: new Date("2026-06-15T12:00:00.000Z"),
            status: "SENT"
          },
          {
            id: "older",
            scheduledFor: new Date("2026-06-15T12:00:00.000Z"),
            status: "PENDING"
          },
          {
            id: "now",
            scheduledFor: now,
            status: "PENDING"
          }
        ],
        now
      ).map((candidate) => candidate.id)
    ).toEqual(["older", "now"]);
  });
});

describe("createReminderIdempotencyKey", () => {
  it("uses user, type, entity, and UTC scheduled date", () => {
    expect(
      createReminderIdempotencyKey({
        userId: "user-1",
        type: "ITEM_CHECK",
        itemId: "item-1",
        scheduledFor: new Date("2026-06-16T23:30:00.000Z")
      })
    ).toBe("user-1:ITEM_CHECK:item-1:2026-06-16");
  });
});
