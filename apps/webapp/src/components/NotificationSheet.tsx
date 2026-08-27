"use client";

import { BottomSheet } from "./common";
import { formatDate } from "../lib/format";
import { reminderEntityLabels } from "../lib/ui";
import type { InAppReminder, ShoppingListEntry } from "../lib/types";

export function NotificationSheet({
  show,
  shoppingList,
  inAppReminders,
  onClose,
  onOpenShoppingEntry,
  onOpenReminder
}: {
  show: boolean;
  shoppingList: ShoppingListEntry[];
  inAppReminders: InAppReminder[];
  onClose: () => void;
  onOpenShoppingEntry: (entry: ShoppingListEntry) => void;
  onOpenReminder: (reminder: InAppReminder) => void;
}) {
  if (!show) {
    return null;
  }

  const notificationCount = shoppingList.length + inAppReminders.length;

  return (
    <BottomSheet show={show} title="Уведомления" onClose={onClose}>
      {notificationCount ? (
        <div className="ds-bottom-sheet__content">
          {shoppingList.length ? (
            <section className="ds-notification-list" aria-label="Что купить">
              <h3 className="ds-notification-list__title">Купить</h3>
              {shoppingList.map((entry) => (
                <button
                  key={entry.id}
                  className="ds-notification-row"
                  type="button"
                  onClick={() => onOpenShoppingEntry(entry)}
                >
                  <span className="ds-notification-row__title">{entry.title}</span>
                  <span className="ds-notification-row__meta">
                    {entry.category?.name ? <span>{entry.category.name}</span> : null}
                    <span
                      className={
                        entry.priority === "URGENT"
                          ? "ds-notification-badge ds-notification-badge--urgent"
                          : "ds-notification-badge"
                      }
                    >
                      {entry.priority === "URGENT" ? "Срочно" : "Купить"}
                    </span>
                  </span>
                </button>
              ))}
            </section>
          ) : null}
          {inAppReminders.length ? (
            <section className="ds-notification-list" aria-label="Что проверить">
              <h3 className="ds-notification-list__title">Проверить</h3>
              {inAppReminders.map((reminder) => (
                <button
                  key={reminder.id}
                  className="ds-notification-row"
                  type="button"
                  onClick={() => onOpenReminder(reminder)}
                >
                  <span className="ds-notification-row__title">{reminder.title}</span>
                  <span className="ds-notification-row__meta">
                    <span>
                      {reminderEntityLabels[reminder.entityType]} ·{" "}
                      {formatDate(reminder.nextCheckAt)}
                    </span>
                    <span
                      className={
                        reminder.timing === "DUE"
                          ? "ds-notification-badge ds-notification-badge--urgent"
                          : "ds-notification-badge"
                      }
                    >
                      {reminder.timing === "DUE" ? "Пора проверить" : "Скоро"}
                    </span>
                  </span>
                </button>
              ))}
            </section>
          ) : null}
        </div>
      ) : (
        <p className="ds-empty">Нет уведомлений.</p>
      )}
    </BottomSheet>
  );
}
