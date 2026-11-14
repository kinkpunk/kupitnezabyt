"use client";

import { Calendar, ListTodo } from "lucide-react";
import React, { type MouseEvent } from "react";

import { formatDate } from "../../lib/format";
import { reminderEntityLabels } from "../../lib/ui";
import type { CheckSession, InAppReminder, Item } from "../../lib/types";
import { EmptyState, ProductRow, SectionHeader } from "../common";
import { Button } from "../ui/Button";
import { HomeDashboard } from "./HomeDashboard";

export function HomeView({
  items,
  inAppReminders,
  checkSession,
  onSelectTab,
  onStartReminderCheck,
  onSnoozeReminder,
  onOpenReminder,
  onOpenShopping,
  onOpenLowItems,
  onOpenChecks,
  isActionPending
}: {
  items: Item[];
  inAppReminders: InAppReminder[];
  checkSession: CheckSession | null;
  onSelectTab: (tab: "items" | "check") => void;
  onStartReminderCheck: (reminder: InAppReminder) => Promise<void>;
  onSnoozeReminder: (reminder: InAppReminder, days?: number) => Promise<void>;
  onOpenReminder: (reminder: InAppReminder) => void;
  onOpenShopping: () => void;
  onOpenLowItems: () => void;
  onOpenChecks: () => void;
  isActionPending: (key: string) => boolean;
}) {
  const checkedCount =
    checkSession?.items.filter((sessionItem) => sessionItem.checkedAt || sessionItem.selectedStatus)
      .length ?? 0;

  const categoryReminderCount = inAppReminders.filter(
    (reminder) => reminder.entityType === "CATEGORY"
  ).length;

  function handleStartReminderCheck(event: MouseEvent<HTMLButtonElement>, reminder: InAppReminder) {
    event.stopPropagation();
    void onStartReminderCheck(reminder);
  }

  function handleSnoozeReminder(event: MouseEvent<HTMLButtonElement>, reminder: InAppReminder) {
    event.stopPropagation();
    void onSnoozeReminder(reminder);
  }

  function renderReminderMeta(reminder: InAppReminder) {
    const isDue = reminder.timing === "DUE";

    return (
      <span className="ds-reminder-meta">
        <span className={isDue ? "ds-reminder-meta--due" : "ds-reminder-meta--soon"}>
          {isDue ? "Пора проверить" : "Скоро"}
        </span>
        <span>·</span>
        <span>{formatDate(reminder.nextCheckAt)}</span>
      </span>
    );
  }

  function renderReminderActions(reminder: InAppReminder) {
    return (
      <div className="ds-reminder-actions">
        {reminder.entityType !== "ITEM" ? (
          <Button
            size="compact"
            variant="accent"
            onClick={(event) => handleStartReminderCheck(event, reminder)}
          >
            <ListTodo aria-hidden="true" size={16} />
            Проверить
          </Button>
        ) : null}
        <Button
          disabled={isActionPending(`reminder:snooze:${reminder.id}`)}
          size="compact"
          variant="ghost"
          onClick={(event) => handleSnoozeReminder(event, reminder)}
        >
          {isActionPending(`reminder:snooze:${reminder.id}`) ? "Откладываем..." : "Отложить"}
        </Button>
      </div>
    );
  }

  function renderReminderList(reminders: InAppReminder[]) {
    return (
      <div className="ds-product-list">
        {reminders.map((reminder) => (
          <ProductRow
            key={reminder.id}
            actions={renderReminderActions(reminder)}
            meta={renderReminderMeta(reminder)}
            subtitle={reminderEntityLabels[reminder.entityType]}
            title={reminder.title}
            onClick={() => onOpenReminder(reminder)}
          />
        ))}
      </div>
    );
  }

  return (
    <section className="stack">
      <HomeDashboard
        items={items}
        categoryReminderCount={categoryReminderCount}
        onOpenChecks={onOpenChecks}
        onOpenLowItems={onOpenLowItems}
        onOpenShopping={onOpenShopping}
      />

      {checkSession?.status === "IN_PROGRESS" ? (
        <section className="home-section">
          <SectionHeader title="Проверка" />
          <ProductRow
            actions={
              <Button size="compact" variant="ghost" onClick={() => onSelectTab("check")}>
                Продолжить
              </Button>
            }
            meta={`${checkedCount + 1} из ${checkSession.items.length}`}
            subtitle="Незавершенная проверка"
            title={checkSession.category?.name ?? "Проверка"}
            onClick={() => onSelectTab("check")}
          />
        </section>
      ) : null}

      <section className="home-section">
        <SectionHeader title="Проверки" />
        {inAppReminders.length ? (
          renderReminderList(inAppReminders)
        ) : (
          <EmptyState
            actionLabel="Начать проверку"
            description="Добавьте циклы проверки, чтобы видеть ближайшие даты"
            icon={Calendar}
            title="Нет проверок"
            onAction={() => onSelectTab("check")}
          />
        )}
      </section>
    </section>
  );
}
