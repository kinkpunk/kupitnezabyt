import type { InAppReminder } from "./types";

export function getReminderDraftKey(
  entityType: InAppReminder["entityType"],
  entityId: string
): string {
  return `${entityType}:${entityId}`;
}
