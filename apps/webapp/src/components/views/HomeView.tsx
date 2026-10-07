"use client";

import { Calendar, ShoppingCart } from "lucide-react";
import React, { type MouseEvent } from "react";

import { formatDate } from "../../lib/format";
import { reminderEntityLabels } from "../../lib/ui";
import type { Category, CheckSession, InAppReminder, Item, ShoppingListEntry } from "../../lib/types";
import { EmptyState, ProductRow, SectionHeader } from "../common";
import { Button } from "../ui/Button";

export function HomeView({
  items,
  inAppReminders,
  checkSession,
  needBuyItems,
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
  needBuyItems: Item[];
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

  function handleMarkBought(event: MouseEvent<HTMLButtonElement>, item: Item) {
    event.stopPropagation();
    void onSetStatus(item, "IN_STOCK");
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

  const needBuyCount = items.filter((item) => item.status === "NEED_BUY").length;
  const lowCount = items.filter((item) => item.status === "LOW").length;
  const categoryReminderCount = inAppReminders.filter(
    (reminder) => reminder.entityType === "CATEGORY"
  ).length;
  const groupReminderCount = inAppReminders.filter(
    (reminder) => reminder.entityType === "GROUP"
  ).length;

  const summaryGroups = [
    {
      key: "items",
      title: "Товары",
      metrics: [
        { key: "need-buy", label: "Купить сейчас", count: needBuyCount, tone: "bad" },
        { key: "low", label: "Осталось мало", count: lowCount, tone: "warn" }
      ]
    },
    {
      key: "check",
      title: "К проверке",
      metrics: [
        {
          key: "categories",
          label: "Категории",
          count: categoryReminderCount,
          tone: "brand"
        },
        { key: "groups", label: "Наборы", count: groupReminderCount, tone: "brand" }
      ]
    }
  ] as const;
  const hasSummaryActivity = summaryGroups.some((group) =>
    group.metrics.some((metric) => metric.count > 0)
  );

  return (
    <section className="stack">
      <div className="ds-home-summary">
        {hasSummaryActivity ? (
          <div className="ds-home-summary__groups">
            {summaryGroups.map((group) => (
              <div key={group.key} className="ds-home-summary__group">
                <p className="ds-home-summary__group-title">{group.title}</p>
                <ul className="ds-home-summary__list">
                  {group.metrics.map((metric) => (
                    <li key={metric.key} className="ds-home-summary__row">
                      <span className="ds-home-summary__row-label">
                        <span
                          aria-hidden="true"
                          className={`ds-home-summary__metric-dot ds-home-summary__metric-dot--${metric.tone}`}
                        />
                        {metric.label}
                      </span>
                      <span
                        className={
                          metric.count
                            ? `ds-home-summary__metric-value ds-home-summary__metric-value--${metric.tone}`
                            : "ds-home-summary__metric-value"
                        }
                      >
                        {metric.count}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ) : (
          <p className="ds-home-summary__ok">
            <span aria-hidden="true" className="ds-home-summary__metric-dot ds-home-summary__metric-dot--ok" />
            Всё в порядке
          </p>
        )}
      </div>

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
            title={checkSession.category?.name ?? checkSession.group?.name ?? "Проверка"}
            onClick={() => onSelectTab("check")}
          />
        </section>
      ) : null}

      <section className="home-section">
        <SectionHeader title="Купить сейчас" />
        {needBuyItems.length ? (
          <div className="ds-product-list">
            {needBuyItems.map((item) => (
              <ProductRow
                key={item.id}
                actions={
                  <Button
                    disabled={isActionPending(`item:status:${item.id}`)}
                    size="compact"
                    variant="primary"
                    onClick={(event) => handleMarkBought(event, item)}
                  >
                    {isActionPending(`item:status:${item.id}`) ? "Отмечаем..." : "Куплено"}
                  </Button>
                }
                subtitle={item.category?.name}
                title={item.name}
                onClick={() => onSelectCategory(item.categoryId)}
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
        <SectionHeader title="Проверки" />
        {inAppReminders.length ? (
          renderReminderList(inAppReminders)
        ) : (
          <EmptyState
            description="Добавьте циклы проверки, чтобы видеть ближайшие даты"
            icon={Calendar}
            title="Нет проверок"
          />
        )}
      </section>
    </section>
  );
}
