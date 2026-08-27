"use client";

import type { InAppReminder } from "../../lib/types";
import { getReminderDraftKey } from "../../lib/reminder-draft";
import { SectionHeader } from "../common";
import { Button } from "../ui/Button";
import type { ReminderDraft } from "../../hooks/useAppState";

export function ReminderSettingsSection({
  title,
  emptyMessage,
  saveLabel,
  isSaving,
  rows,
  drafts,
  onDraftChange,
  onSave
}: {
  title: string;
  emptyMessage: string;
  saveLabel: string;
  isSaving: boolean;
  rows: {
    id: string;
    entityType: InAppReminder["entityType"];
    title: string;
    subtitle: string;
  }[];
  drafts: Record<string, ReminderDraft>;
  onDraftChange: (key: string, draft: ReminderDraft) => void;
  onSave: () => void;
}) {
  return (
    <section className="ds-reminder-settings-group">
      <SectionHeader
        actions={
          rows.length ? (
            <Button
              disabled={isSaving}
              size="compact"
              variant="primary"
              onClick={onSave}
            >
              {isSaving ? "Сохраняем..." : saveLabel}
            </Button>
          ) : null
        }
        subtitle={
          rows.length
            ? "Настройте каждую карточку и сохраните секцию целиком."
            : undefined
        }
        title={title}
      />
      {rows.length ? (
        <div className="ds-reminder-settings-list">
          {rows.map((row) => {
            const key = getReminderDraftKey(row.entityType, row.id);
            const draft = drafts[key] ?? {
              usageCycleDays: "",
              reminderEnabled: true
            };

            return (
              <article className="ds-reminder-settings-row" key={key}>
                <div>
                  <h4>{row.title}</h4>
                  <p>{row.subtitle}</p>
                </div>
                <label className="ds-reminder-toggle">
                  <input
                    aria-label={`Напоминания: ${row.title}`}
                    checked={draft.reminderEnabled}
                    disabled={isSaving}
                    type="checkbox"
                    onChange={(event) =>
                      onDraftChange(key, {
                        ...draft,
                        reminderEnabled: event.target.checked
                      })
                    }
                  />
                  <span>Вкл.</span>
                </label>
                <input
                  aria-label={`Цикл проверки: ${row.title}`}
                  disabled={isSaving}
                  inputMode="numeric"
                  min="1"
                  placeholder="Дней"
                  type="number"
                  value={draft.usageCycleDays}
                  onChange={(event) =>
                    onDraftChange(key, {
                      ...draft,
                      usageCycleDays: event.target.value
                    })
                  }
                />
              </article>
            );
          })}
        </div>
      ) : (
        <p className="ds-empty">{emptyMessage}</p>
      )}
    </section>
  );
}
