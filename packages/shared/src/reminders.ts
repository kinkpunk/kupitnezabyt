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
