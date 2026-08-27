"use client";

import { Calendar, ShoppingCart } from "lucide-react";
import React from "react";

import { formatDate } from "../../lib/format";
import type { Category, CheckSession, InAppReminder, Item, ShoppingListEntry } from "../../lib/types";
import {
  formatPositionCount,
  formatReminderCount,
  itemStatusToUiStatus,
  reminderEntityLabels
} from "../../lib/ui";
import { EmptyState, ProductRow, SectionHeader } from "../common";
import { Button } from "../ui/Button";

export function HomeView({
  items,
  inAppReminders,
  checkSession,
  urgentItems,
  attentionItemsCount,
  itemReminders,
  categoryReminders: categoryReminderList,
  groupReminders,
  onSelectTab,
  onSelectCategory,
  onSetStatus,
  onStartReminderCheck,
  onSnoozeReminder,
  onOpenReminder,
  isActionPending
}: {
  items: Item[];
  categories: Category[];
  shoppingList: ShoppingListEntry[];
  inAppReminders: InAppReminder[];
  checkSession: CheckSession | null;
  urgentItems: Item[];
  attentionItemsCount: number;
  itemReminders: InAppReminder[];
  categoryReminders: InAppReminder[];
  groupReminders: InAppReminder[];
  onSelectTab: (tab: "items" | "check") => void;
  onSelectCategory: (categoryId: string) => void;
  onSetStatus: (item: Item, status: Item["status"]) => Promise<void>;
  onStartReminderCheck: (reminder: InAppReminder) => Promise<void>;
  onSnoozeReminder: (reminder: InAppReminder, days?: number) => Promise<void>;
  onOpenReminder: (reminder: InAppReminder) => void;
  isActionPending: (key: string) => boolean;
}) {
  const checkedCount =
    checkSession?.items.filter((sessionItem) => sessionItem.checkedAt || sessionItem.selectedStatus)
      .length ?? 0;

  function handleMarkBought(item: Item) {
    void onSetStatus(item, "IN_STOCK");
  }

  function getItemStatus(item: Item): "ok" | "warn" | "bad" | "paused" {
    if (item.status === "PAUSED") {
      return "paused";
    }

    return itemStatusToUiStatus(item.status) ?? "paused";
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
            variant="primary"
            onClick={() => void onStartReminderCheck(reminder)}
          >
            Проверить
          </Button>
        ) : null}
        <Button
          disabled={isActionPending(`reminder:snooze:${reminder.id}`)}
          size="compact"
          variant="ghost"
          onClick={() => void onSnoozeReminder(reminder)}
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
      <button
        className="ds-home-summary"
        type="button"
        onClick={() => onSelectTab("items")}
      >
        <span className="ds-home-summary__eyebrow">Запасы</span>
        <span
          className={
            attentionItemsCount
              ? "ds-home-summary__value ds-home-summary__value--attention"
              : "ds-home-summary__value ds-home-summary__value--ok"
          }
        >
          {attentionItemsCount ? attentionItemsCount : "Все запасы в порядке"}
        </span>
        <span className="ds-home-summary__caption">
          {attentionItemsCount
            ? "требуют внимания"
            : items.length
              ? `${items.length} отслеживается`
              : "Добавьте первые товары"}
        </span>
      </button>

      {checkSession?.status === "IN_PROGRESS" ? (
        <section className="home-section">
          <SectionHeader title="Проверка" />
          <ProductRow
            actions={
              <Button size="compact" variant="ghost" onClick={() => onSelectTab("check")}>
                Продолжить
              </Button>
            }
            meta={`${checkedCount} из ${checkSession.items.length}`}
            subtitle="Незавершенная проверка"
            title={checkSession.category?.name ?? checkSession.group?.name ?? "Проверка"}
            onClick={() => onSelectTab("check")}
          />
        </section>
      ) : null}

      <section className="home-section">
        <SectionHeader
          title="Купить сейчас"
          subtitle={urgentItems.length ? formatPositionCount(urgentItems.length) : "Пока спокойно"}
        />
        {urgentItems.length ? (
          <div className="ds-product-list">
            {urgentItems.map((item) => (
              <ProductRow
                key={item.id}
                status={getItemStatus(item)}
                subtitle={item.category?.name}
                title={item.name}
                onClick={() => onSelectCategory(item.categoryId)}
                onStatusClick={() => handleMarkBought(item)}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            description="Нет товаров, которые нужно купить прямо сейчас"
            icon={ShoppingCart}
            title="Пока спокойно"
          />
        )}
      </section>

      <section className="home-section">
        <SectionHeader
          title="Напоминания"
          subtitle={inAppReminders.length ? `${inAppReminders.length} активных` : "Нет дат"}
        />
        {inAppReminders.length ? (
          <div className="reminder-groups">
            {categoryReminderList.length ? (
              <section className="reminder-group" aria-label="Напоминания категорий">
                <SectionHeader
                  subtitle={formatReminderCount(categoryReminderList.length)}
                  title="Категории"
                />
                {renderReminderList(categoryReminderList)}
              </section>
            ) : null}
            {groupReminders.length ? (
              <section className="reminder-group" aria-label="Напоминания наборов">
                <SectionHeader
                  subtitle={formatReminderCount(groupReminders.length)}
                  title="Наборы"
                />
                {renderReminderList(groupReminders)}
              </section>
            ) : null}
            {itemReminders.length ? (
              <section className="reminder-group" aria-label="Напоминания товаров">
                <SectionHeader
                  subtitle={formatReminderCount(itemReminders.length)}
                  title="Товары"
                />
                {renderReminderList(itemReminders)}
              </section>
            ) : null}
          </div>
        ) : (
          <EmptyState
            description="Добавьте циклы проверки, чтобы видеть ближайшие даты"
            icon={Calendar}
            title="Нет напоминаний"
          />
        )}
      </section>
    </section>
  );
}
