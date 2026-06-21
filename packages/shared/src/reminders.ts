import type { ReminderStatus, ReminderType } from "./types.js";

const millisecondsInDay = 24 * 60 * 60 * 1000;

export type ReminderCandidate = {
  id: string;
  scheduledFor: Date;
  status: ReminderStatus;
};

export type ReminderKeyInput = {
  userId: string;
  type: ReminderType;
  scheduledFor: Date;
  itemId?: string | null;
  categoryId?: string | null;
  groupId?: string | null;
};

export type InAppReminderEntityType = "CATEGORY" | "GROUP" | "ITEM";

export type InAppReminderCandidate = {
  id: string;
  entityType: InAppReminderEntityType;
  title: string;
  nextCheckAt: Date | null;
  reminderEnabled: boolean;
  archivedAt?: Date | null;
  status?: string | null;
};

export type InAppReminder<TCandidate extends InAppReminderCandidate = InAppReminderCandidate> =
  TCandidate & {
    timing: "DUE" | "UPCOMING";
  };

export function calculateSnoozedUntil(now: Date, days: number): Date {
  if (!Number.isInteger(days) || days <= 0) {
    throw new Error("SNOOZE_DAYS_INVALID");
  }

  return new Date(now.getTime() + days * millisecondsInDay);
}

export function getDueReminderCandidates<TCandidate extends ReminderCandidate>(
  candidates: readonly TCandidate[],
  now: Date
): TCandidate[] {
  return candidates
    .filter(
      (candidate) =>
        candidate.status === "PENDING" && candidate.scheduledFor.getTime() <= now.getTime()
    )
    .sort((left, right) => left.scheduledFor.getTime() - right.scheduledFor.getTime());
}

export function createReminderIdempotencyKey(input: ReminderKeyInput): string {
  const entityId = input.itemId ?? input.categoryId ?? input.groupId ?? "none";
  const scheduledDate = input.scheduledFor.toISOString().slice(0, 10);

  return [input.userId, input.type, entityId, scheduledDate].join(":");
}

export function getInAppReminders<TCandidate extends InAppReminderCandidate>(
  candidates: readonly TCandidate[],
  now: Date,
  upcomingWindowDays = 7,
  limit = 20
): InAppReminder<TCandidate>[] {
  const upcomingUntil = new Date(now.getTime() + upcomingWindowDays * millisecondsInDay);

  return candidates
    .filter((candidate) => {
      if (
        !candidate.reminderEnabled ||
        candidate.archivedAt ||
        candidate.status === "PAUSED" ||
        !candidate.nextCheckAt
      ) {
        return false;
      }

      return candidate.nextCheckAt.getTime() <= upcomingUntil.getTime();
    })
    .sort((left, right) => {
      const leftTime = left.nextCheckAt?.getTime() ?? Number.POSITIVE_INFINITY;
      const rightTime = right.nextCheckAt?.getTime() ?? Number.POSITIVE_INFINITY;
      return leftTime - rightTime || left.title.localeCompare(right.title);
    })
    .slice(0, limit)
    .map((candidate) => ({
      ...candidate,
      timing:
        candidate.nextCheckAt && candidate.nextCheckAt.getTime() <= now.getTime()
          ? "DUE"
          : "UPCOMING"
    }));
}
