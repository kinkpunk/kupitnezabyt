"use client";

import React from "react";
import { Bell, ShoppingCart } from "lucide-react";

import { BottomSheet, EmptyState } from "./common";
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
        <>
          {shoppingList.length ? (
            <section className="ds-notification-group" aria-label="Что купить">
              <h3 className="ds-notification-group__title">Купить</h3>
              <div className="ds-bottom-sheet__actions">
                {shoppingList.map((entry) => {
                  const isUrgent = entry.priority === "URGENT";

                  return (
                    <button
                      key={entry.id}
                      className="ds-bottom-sheet__action ds-bottom-sheet__action--multiline"
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenShoppingEntry(entry);
                      }}
                    >
                      <ShoppingCart aria-hidden="true" size={18} strokeWidth={2.25} />
                      <span className="ds-notification-action__text">
                        <span className="ds-notification-action__title">{entry.title}</span>
                        {entry.category?.name ? (
                          <span className="ds-notification-action__meta">{entry.category.name}</span>
                        ) : null}
                      </span>
                      <span
                        className={
                          isUrgent
                            ? "ds-notification-badge ds-notification-badge--urgent"
                            : "ds-notification-badge"
                        }
                      >
                        {isUrgent ? "Срочно" : "Купить"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          ) : null}
          {inAppReminders.length ? (
            <section className="ds-notification-group" aria-label="Что проверить">
              <h3 className="ds-notification-group__title">Проверить</h3>
              <div className="ds-bottom-sheet__actions">
                {inAppReminders.map((reminder) => {
                  const isDue = reminder.timing === "DUE";

                  return (
                    <button
                      key={reminder.id}
                      className="ds-bottom-sheet__action ds-bottom-sheet__action--multiline"
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenReminder(reminder);
                      }}
                    >
                      <Bell aria-hidden="true" size={18} strokeWidth={2.25} />
                      <span className="ds-notification-action__text">
                        <span className="ds-notification-action__title">{reminder.title}</span>
                        <span className="ds-notification-action__meta">
                          {reminderEntityLabels[reminder.entityType]} ·{" "}
                          {formatDate(reminder.nextCheckAt)}
                        </span>
                      </span>
                      <span
                        className={
                          isDue
                            ? "ds-notification-badge ds-notification-badge--urgent"
                            : "ds-notification-badge"
                        }
                      >
                        {isDue ? "Пора проверить" : "Скоро"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          ) : null}
        </>
      ) : (
        <EmptyState icon={Bell} title="Нет уведомлений" />
      )}
    </BottomSheet>
  );
}
