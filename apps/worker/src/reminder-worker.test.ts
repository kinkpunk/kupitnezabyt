import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  update: vi.fn(),
  sendTelegramMessage: vi.fn()
}));

vi.mock("@kupitnezabyt/database", () => ({
  prisma: {
    reminder: {
      findMany: mocks.findMany,
      update: mocks.update
    }
  }
}));

vi.mock("./telegram.js", () => ({
  sendTelegramMessage: mocks.sendTelegramMessage
}));

import type { WorkerConfig } from "./config.js";
import { processDueReminders } from "./reminder-worker.js";

const config: WorkerConfig = {
  telegramBotToken: "token",
  webAppUrl: "https://example.com",
  pollIntervalMs: 300000,
  reminderBatchSize: 25,
  maxAttempts: 3
};

const now = new Date("2026-06-16T12:00:00.000Z");

describe("processDueReminders", () => {
  beforeEach(() => {
    mocks.findMany.mockReset();
    mocks.update.mockReset();
    mocks.sendTelegramMessage.mockReset();
  });

  it("marks sent reminders after Telegram delivery", async () => {
    mocks.findMany.mockResolvedValue([reminderFixture({ id: "reminder-1" })]);
    mocks.sendTelegramMessage.mockResolvedValue(undefined);

    await expect(processDueReminders(config, now)).resolves.toBe(1);

    expect(mocks.sendTelegramMessage).toHaveBeenCalledOnce();
    expect(mocks.update).toHaveBeenCalledWith({
      where: {
        id: "reminder-1"
      },
      data: {
        status: "SENT",
        sentAt: now
      }
    });
  });

  it("reschedules failed reminders with bounded backoff", async () => {
    mocks.findMany.mockResolvedValue([
      reminderFixture({
        id: "reminder-1",
        attemptCount: 1
      })
    ]);
    mocks.sendTelegramMessage.mockRejectedValue(new Error("temporary"));

    await expect(processDueReminders(config, now)).resolves.toBe(1);

    expect(mocks.update).toHaveBeenCalledWith({
      where: {
        id: "reminder-1"
      },
      data: {
        attemptCount: 2,
        scheduledFor: new Date("2026-06-16T12:02:00.000Z")
      }
    });
  });

  it("marks reminders failed after the last attempt", async () => {
    mocks.findMany.mockResolvedValue([
      reminderFixture({
        id: "reminder-1",
        attemptCount: 2
      })
    ]);
    mocks.sendTelegramMessage.mockRejectedValue(new Error("temporary"));

    await expect(processDueReminders(config, now)).resolves.toBe(1);

    expect(mocks.update).toHaveBeenCalledWith({
      where: {
        id: "reminder-1"
      },
      data: {
        status: "FAILED",
        attemptCount: 3
      }
    });
  });
});

function reminderFixture(overrides: {
  id: string;
  attemptCount?: number;
}): Record<string, unknown> {
  return {
    id: overrides.id,
    type: "ITEM_CHECK",
    attemptCount: overrides.attemptCount ?? 0,
    item: {
      id: "item-1",
      name: "кофе",
      archivedAt: null,
      reminderEnabled: true,
      status: "IN_STOCK"
    },
    user: {
      telegramUserId: "42"
    }
  };
}
