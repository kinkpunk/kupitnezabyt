"use client";

import { Check } from "lucide-react";

import { formatDate } from "../../lib/format";
import {
  formatPositionCount,
  formatReminderCount,
  reminderEntityLabels
} from "../../lib/ui";
import type {
  Category,
  CheckSession,
  InAppReminder,
  Item,
  ShoppingListEntry
} from "../../lib/types";

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

  function renderReminderActions(reminder: InAppReminder) {
    return (
      <div className="reminder-actions">
        {reminder.entityType !== "ITEM" ? (
          <button
            className="primary-light-button"
            type="button"
            onClick={() => void onStartReminderCheck(reminder)}
          >
            Проверить
          </button>
        ) : null}
        <button
          className="ghost-button"
          type="button"
          disabled={isActionPending(`reminder:snooze:${reminder.id}`)}
          onClick={() => void onSnoozeReminder(reminder)}
        >
          {isActionPending(`reminder:snooze:${reminder.id}`) ? "Откладываем..." : "Отложить"}
        </button>
        <button className="ghost-button" type="button" onClick={() => onOpenReminder(reminder)}>
          Подробнее
        </button>
      </div>
    );
  }

  function renderReminderList(reminders: InAppReminder[]) {
    return (
      <div className="item-list">
        {reminders.map((reminder) => (
          <article className="shopping-row reminder-row" key={reminder.id}>
            <div>
              <span className={reminder.timing === "DUE" ? "badge badge-urgent" : "badge badge-muted"}>
                {reminder.timing === "DUE" ? "Пора проверить" : "Скоро"} ·{" "}
                {formatDate(reminder.nextCheckAt)}
              </span>
              <h2>{reminder.title}</h2>
              <span className="metadata-text">{reminderEntityLabels[reminder.entityType]}</span>
            </div>
            {renderReminderActions(reminder)}
          </article>
        ))}
      </div>
    );
  }

  return (
    <section className="stack">
      <div className="home-summary">
        <button
          className={
            attentionItemsCount ? "home-tile home-tile-attention" : "home-tile home-tile-ok"
          }
          type="button"
          onClick={() => onSelectTab("items")}
        >
          <span className="eyebrow">Запасы</span>
          {attentionItemsCount ? (
            <>
              <strong>{attentionItemsCount}</strong>
              <span>требуют внимания</span>
            </>
          ) : (
            <>
              <strong>Все запасы в порядке</strong>
              <span>
                {items.length ? `${items.length} отслеживается` : "Добавьте первые товары"}
              </span>
            </>
          )}
        </button>
      </div>

      {checkSession?.status === "IN_PROGRESS" ? (
        <section className="home-section">
          <article className="shopping-row">
            <div>
              <p className="normal">Незавершенная проверка</p>
              <h2>{checkSession.category?.name ?? checkSession.group?.name ?? "Проверка"}</h2>
              <span>
                {checkedCount} из {checkSession.items.length}
              </span>
            </div>
            <button
              className="ghost-button"
              type="button"
              onClick={() => onSelectTab("check")}
            >
              Продолжить
            </button>
          </article>
        </section>
      ) : null}

      <section className="home-section">
        <div className="section-heading">
          <div>
            <h2>Купить сейчас</h2>
            <p>{urgentItems.length ? formatPositionCount(urgentItems.length) : "Пока спокойно"}</p>
          </div>
        </div>
        {urgentItems.length ? (
          <div className="item-list">
            {urgentItems.map((item) => (
              <article className="shopping-row shopping-item-card" key={item.id}>
                <button
                  aria-label={`Открыть ${item.name}`}
                  className="shopping-row-open"
                  type="button"
                  onClick={() => onSelectCategory(item.categoryId)}
                >
                  <span className="shopping-row-title">{item.name}</span>
                  {item.category?.name ? (
                    <span className="metadata-text">{item.category.name}</span>
                  ) : null}
                </button>
                <button
                  className="shopping-item-card-action"
                  type="button"
                  disabled={isActionPending(`item:status:${item.id}`)}
                  onClick={() => void onSetStatus(item, "IN_STOCK")}
                >
                  <Check aria-hidden="true" size={18} />
                  <span>
                    {isActionPending(`item:status:${item.id}`) ? "Отмечаем..." : "Куплено"}
                  </span>
                </button>
              </article>
            ))}
          </div>
        ) : (
          <p className="empty">Нет товаров, которые нужно купить прямо сейчас.</p>
        )}
      </section>

      <section className="home-section">
        <div className="section-heading">
          <div>
            <h2>Напоминания</h2>
            <p>
              {inAppReminders.length ? `${inAppReminders.length} активных` : "Нет дат"}
            </p>
          </div>
        </div>
        {inAppReminders.length ? (
          <div className="reminder-groups">
            {categoryReminderList.length ? (
              <section className="reminder-group" aria-label="Напоминания категорий">
                <div className="reminder-group-heading">
                  <h3>Категории</h3>
                  <span>{formatReminderCount(categoryReminderList.length)}</span>
                </div>
                {renderReminderList(categoryReminderList)}
              </section>
            ) : null}
            {groupReminders.length ? (
              <section className="reminder-group" aria-label="Напоминания наборов">
                <div className="reminder-group-heading">
                  <h3>Наборы</h3>
                  <span>{formatReminderCount(groupReminders.length)}</span>
                </div>
                {renderReminderList(groupReminders)}
              </section>
            ) : null}
            {itemReminders.length ? (
              <section className="reminder-group" aria-label="Напоминания товаров">
                <div className="reminder-group-heading">
                  <h3>Товары</h3>
                  <span>{formatReminderCount(itemReminders.length)}</span>
                </div>
                {renderReminderList(itemReminders)}
              </section>
            ) : null}
          </div>
        ) : (
          <p className="empty">Добавьте циклы проверки, чтобы видеть ближайшие даты.</p>
        )}
      </section>
    </section>
  );
}
