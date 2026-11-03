"use client";

import { Calendar, ListTodo, ShoppingBasket } from "lucide-react";
import React, { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";

import { formatDate } from "../../lib/format";
import { reminderEntityLabels } from "../../lib/ui";
import type { Category, CheckSession, InAppReminder, Item, ShoppingListEntry } from "../../lib/types";
import { EmptyState, ProductRow, SectionHeader } from "../common";
import { Button } from "../ui/Button";
import { PurchaseCheckbox } from "../ui/PurchaseCheckbox";

const BOUGHT_LINGER_MS = 5000;

interface BoughtItemState {
  item: Item;
  previousStatus: Item["status"];
  position: number;
}

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
  onSetStatus: (
    item: Item,
    status: Item["status"],
    options?: { showBoughtToast?: boolean }
  ) => Promise<void>;
  onStartReminderCheck: (reminder: InAppReminder) => Promise<void>;
  onSnoozeReminder: (reminder: InAppReminder, days?: number) => Promise<void>;
  onOpenReminder: (reminder: InAppReminder) => void;
  isActionPending: (key: string) => boolean;
}) {
  const [boughtItems, setBoughtItems] = useState<ReadonlyMap<string, BoughtItemState>>(new Map());
  const [restoringItemIds, setRestoringItemIds] = useState<ReadonlySet<string>>(new Set());
  const boughtTimersRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    const timers = boughtTimersRef.current;
    return () => {
      timers.forEach((timerId) => window.clearTimeout(timerId));
    };
  }, []);

  const displayNeedBuyItems = useMemo(() => {
    if (boughtItems.size === 0) {
      return needBuyItems;
    }
    const result = [...needBuyItems];
    for (const { item, position } of boughtItems.values()) {
      if (result.some((candidate) => candidate.id === item.id)) {
        continue;
      }
      result.splice(Math.min(position, result.length), 0, item);
    }
    return result;
  }, [needBuyItems, boughtItems]);

  const checkedCount =
    checkSession?.items.filter((sessionItem) => sessionItem.checkedAt || sessionItem.selectedStatus)
      .length ?? 0;

  function removeBoughtItem(itemId: string) {
    const timerId = boughtTimersRef.current.get(itemId);
    if (timerId !== undefined) {
      window.clearTimeout(timerId);
      boughtTimersRef.current.delete(itemId);
    }
    setBoughtItems((current) => {
      if (!current.has(itemId)) {
        return current;
      }
      const next = new Map(current);
      next.delete(itemId);
      return next;
    });
  }

  function registerBoughtItem(item: Item, position: number) {
    const existingTimerId = boughtTimersRef.current.get(item.id);
    if (existingTimerId !== undefined) {
      window.clearTimeout(existingTimerId);
    }
    const timerId = window.setTimeout(() => removeBoughtItem(item.id), BOUGHT_LINGER_MS);
    boughtTimersRef.current.set(item.id, timerId);
    setBoughtItems((current) => {
      const next = new Map(current);
      next.set(item.id, { item, previousStatus: item.status, position });
      return next;
    });
  }

  function handleMarkBought(item: Item) {
    const position = Math.max(
      needBuyItems.findIndex((candidate) => candidate.id === item.id),
      0
    );
    void onSetStatus(item, "IN_STOCK", { showBoughtToast: false }).then(() =>
      registerBoughtItem(item, position)
    );
  }

  function clearRestoringItem(itemId: string) {
    setRestoringItemIds((current) => {
      if (!current.has(itemId)) {
        return current;
      }
      const next = new Set(current);
      next.delete(itemId);
      return next;
    });
  }

  function handleUndoBought(itemId: string) {
    const bought = boughtItems.get(itemId);
    if (!bought) {
      return;
    }
    setRestoringItemIds((current) => new Set(current).add(itemId));
    removeBoughtItem(itemId);
    void onSetStatus(bought.item, bought.previousStatus, { showBoughtToast: false });
  }

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

  const needBuyCount = items.filter((item) => item.status === "NEED_BUY").length;
  const lowCount = items.filter((item) => item.status === "LOW").length;
  const categoryReminderCount = inAppReminders.filter(
    (reminder) => reminder.entityType === "CATEGORY"
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
          tone: "check"
        }
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
            title={checkSession.category?.name ?? "Проверка"}
            onClick={() => onSelectTab("check")}
          />
        </section>
      ) : null}

      <section className="home-section">
        <SectionHeader title="Купить сейчас" />
        {displayNeedBuyItems.length ? (
          <div className="ds-product-list">
            {displayNeedBuyItems.map((item) => (
              <ProductRow
                key={item.id}
                actions={
                  boughtItems.has(item.id) ? (
                    <div className="ds-shopping-actions ds-shopping-actions--bought">
                      <span className="ds-shopping-actions__bought" role="status" aria-label="Куплено">
                        Куплено
                      </span>
                      <button
                        type="button"
                        className="ds-shopping-actions__undo"
                        onClick={() => handleUndoBought(item.id)}
                      >
                        Отмена
                      </button>
                    </div>
                  ) : (
                    <div
                      className={
                        restoringItemIds.has(item.id)
                          ? "ds-shopping-actions ds-shopping-actions--restoring"
                          : "ds-shopping-actions"
                      }
                      onAnimationEnd={
                        restoringItemIds.has(item.id)
                          ? () => clearRestoringItem(item.id)
                          : undefined
                      }
                    >
                      <PurchaseCheckbox
                        pending={isActionPending(`item:status:${item.id}`)}
                        onMark={() => handleMarkBought(item)}
                      />
                    </div>
                  )
                }
                subtitle={item.category?.name}
                title={item.name}
                onClick={() => onSelectCategory(item.categoryId)}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            actionLabel="К категориям"
            description="Нет товаров, которые нужно купить прямо сейчас"
            icon={ShoppingBasket}
            title="Пока спокойно"
            onAction={() => onSelectTab("items")}
          />
        )}
      </section>

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
