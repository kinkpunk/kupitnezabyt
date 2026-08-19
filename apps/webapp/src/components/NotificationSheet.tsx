"use client";

import { X } from "lucide-react";

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
    <div className="menu-sheet-overlay" onClick={onClose}>
      <section
        aria-label="Уведомления"
        className="menu-sheet notification-sheet"
        id="notification-sheet"
        role="dialog"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="menu-sheet-header">
          <strong>Уведомления</strong>
          <button
            aria-label="Закрыть уведомления"
            className="ghost-button"
            type="button"
            onClick={onClose}
          >
            <X aria-hidden="true" size={18} />
          </button>
        </div>
        {notificationCount ? (
          <>
            {shoppingList.length ? (
              <div className="notification-list" aria-label="Что купить">
                <p className="eyebrow">Купить</p>
                {shoppingList.map((entry) => (
                  <button
                    className="notification-row"
                    key={entry.id}
                    type="button"
                    onClick={() => onOpenShoppingEntry(entry)}
                  >
                    <span className="notification-row-title">{entry.title}</span>
                    <span className="shopping-meta-line">
                      {entry.category?.name ? (
                        <span className="metadata-text">{entry.category.name}</span>
                      ) : null}
                      <span
                        className={
                          entry.priority === "URGENT" ? "badge badge-urgent" : "badge badge-muted"
                        }
                      >
                        {entry.priority === "URGENT" ? "Срочно" : "Купить"}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
            {inAppReminders.length ? (
              <div className="notification-list" aria-label="Что проверить">
                <p className="eyebrow">Проверить</p>
                {inAppReminders.map((reminder) => (
                  <button
                    className="notification-row"
                    key={reminder.id}
                    type="button"
                    onClick={() => onOpenReminder(reminder)}
                  >
                    <span className="notification-row-title">{reminder.title}</span>
                    <span className="shopping-meta-line">
                      <span className="metadata-text">
                        {reminderEntityLabels[reminder.entityType]} ·{" "}
                        {formatDate(reminder.nextCheckAt)}
                      </span>
                      <span
                        className={
                          reminder.timing === "DUE" ? "badge badge-urgent" : "badge badge-muted"
                        }
                      >
                        {reminder.timing === "DUE" ? "Пора проверить" : "Скоро"}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
          </>
        ) : (
          <p className="empty">Нет уведомлений.</p>
        )}
      </section>
    </div>
  );
}
