import { describe, expect, it } from "vitest";

import {
  calculateSnoozedUntil,
  createReminderIdempotencyKey,
  getDueReminderCandidates,
  getInAppReminders
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

describe("getInAppReminders", () => {
  const now = new Date("2026-06-16T12:00:00.000Z");

  it("returns due and upcoming enabled checks sorted by check date", () => {
    const reminders = getInAppReminders(
      [
        {
          id: "future",
          entityType: "ITEM",
          title: "Rice",
          nextCheckAt: new Date("2026-06-18T12:00:00.000Z"),
          reminderEnabled: true
        },
        {
          id: "due",
          entityType: "CATEGORY",
          title: "Pharmacy",
          nextCheckAt: new Date("2026-06-16T11:00:00.000Z"),
          reminderEnabled: true
        }
      ],
      now
    );

    expect(reminders.map((reminder) => [reminder.id, reminder.timing])).toEqual([
      ["due", "DUE"],
      ["future", "UPCOMING"]
    ]);
  });

  it("excludes disabled, archived, paused, unscheduled, and distant checks", () => {
    const reminders = getInAppReminders(
      [
        {
          id: "enabled",
          entityType: "GROUP",
          title: "Travel",
          nextCheckAt: new Date("2026-06-20T12:00:00.000Z"),
          reminderEnabled: true
        },
        {
          id: "disabled",
          entityType: "ITEM",
          title: "Coffee",
          nextCheckAt: new Date("2026-06-17T12:00:00.000Z"),
          reminderEnabled: false
        },
        {
          id: "archived",
          entityType: "ITEM",
          title: "Archived",
          nextCheckAt: new Date("2026-06-17T12:00:00.000Z"),
          reminderEnabled: true,
          archivedAt: new Date("2026-06-15T12:00:00.000Z")
        },
        {
          id: "paused",
          entityType: "ITEM",
          title: "Paused",
          nextCheckAt: new Date("2026-06-17T12:00:00.000Z"),
          reminderEnabled: true,
          status: "PAUSED"
        },
        {
          id: "unscheduled",
          entityType: "CATEGORY",
          title: "No date",
          nextCheckAt: null,
          reminderEnabled: true
        },
        {
          id: "distant",
          entityType: "CATEGORY",
          title: "Later",
          nextCheckAt: new Date("2026-07-01T12:00:00.000Z"),
          reminderEnabled: true
        }
      ],
      now,
      7
    );

    expect(reminders.map((reminder) => reminder.id)).toEqual(["enabled"]);
  });

  it("respects the reminder limit", () => {
    const reminders = getInAppReminders(
      [
        {
          id: "first",
          entityType: "ITEM",
          title: "First",
          nextCheckAt: new Date("2026-06-17T12:00:00.000Z"),
          reminderEnabled: true
        },
        {
          id: "second",
          entityType: "ITEM",
          title: "Second",
          nextCheckAt: new Date("2026-06-18T12:00:00.000Z"),
          reminderEnabled: true
        }
      ],
      now,
      7,
      1
    );

    expect(reminders.map((reminder) => reminder.id)).toEqual(["first"]);
  });
});
