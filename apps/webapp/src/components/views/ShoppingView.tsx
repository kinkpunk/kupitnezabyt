"use client";

import type { ShoppingPriority } from "@kupitnezabyt/shared";
import { Pencil, ShoppingCart, Trash2 } from "lucide-react";
import React, { useMemo, useState } from "react";

import { formatError } from "../../lib/format";
import type { Category, ShoppingListEntry } from "../../lib/types";
import { BottomSheet, EmptyState, ProductRow, ProductRowMoreButton, SectionHeader } from "../common";
import { Button } from "../ui/Button";

export function ShoppingView({
  shoppingList,
  shoppingGroups,
  categories,
  manualShoppingTitle,
  setManualShoppingTitle,
  manualShoppingCategoryId,
  setManualShoppingCategoryId,
  manualShoppingPriority,
  setManualShoppingPriority,
  editingShoppingId,
  setEditingShoppingId,
  editingShoppingTitle,
  setEditingShoppingTitle,
  onCreateManualShoppingItem,
  onUpdateManualShoppingItem,
  onDeleteManualShoppingItem,
  onCompleteShoppingListItem,
  onClearCompletedShoppingList,
  setError,
  isActionPending
}: {
  shoppingList: ShoppingListEntry[];
  shoppingGroups: { id: string; title: string; entries: ShoppingListEntry[] }[];
  categories: Category[];
  manualShoppingTitle: string;
  setManualShoppingTitle: (value: string) => void;
  manualShoppingCategoryId: string;
  setManualShoppingCategoryId: (value: string) => void;
  manualShoppingPriority: ShoppingPriority;
  setManualShoppingPriority: (value: ShoppingPriority) => void;
  editingShoppingId: string | null;
  setEditingShoppingId: (value: string | null) => void;
  editingShoppingTitle: string;
  setEditingShoppingTitle: (value: string) => void;
  onCreateManualShoppingItem: () => Promise<void>;
  onUpdateManualShoppingItem: (entry: ShoppingListEntry) => Promise<void>;
  onDeleteManualShoppingItem: (entry: ShoppingListEntry) => Promise<void>;
  onCompleteShoppingListItem: (entry: ShoppingListEntry) => Promise<void>;
  onClearCompletedShoppingList: () => Promise<void>;
  setError: (message: string | null) => void;
  isActionPending: (key: string) => boolean;
}) {
  const [activeEntryId, setActiveEntryId] = useState<string | null>(null);
  const activeEntry = useMemo(
    () => shoppingList.find((entry) => entry.id === activeEntryId) ?? null,
    [shoppingList, activeEntryId]
  );

  function handleClearCompleted() {
    void onClearCompletedShoppingList().catch((caughtError) => setError(formatError(caughtError)));
  }

  function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void onCreateManualShoppingItem().catch((caughtError) => setError(formatError(caughtError)));
  }

  function handleUpdate(entry: ShoppingListEntry, event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void onUpdateManualShoppingItem(entry).catch((caughtError) => setError(formatError(caughtError)));
  }

  function handleDelete(entry: ShoppingListEntry) {
    void onDeleteManualShoppingItem(entry).catch((caughtError) => setError(formatError(caughtError)));
    setActiveEntryId(null);
  }

  function handleComplete(entry: ShoppingListEntry) {
    void onCompleteShoppingListItem(entry).catch((caughtError) => setError(formatError(caughtError)));
  }

  function getEntrySubtitle(entry: ShoppingListEntry): string {
    return entry.category?.name ?? (entry.itemId ? "Отслеживаемый товар" : "Разовая позиция");
  }

  function renderEntryActions(entry: ShoppingListEntry) {
    return (
      <div className="ds-shopping-actions">
        <Button
          size="compact"
          variant="primary"
          disabled={isActionPending(`shopping:bought:${entry.id}`)}
          onClick={() => handleComplete(entry)}
        >
          {isActionPending(`shopping:bought:${entry.id}`) ? "Отмечаем..." : "Куплено"}
        </Button>
        {!entry.itemId ? (
          <ProductRowMoreButton onClick={() => setActiveEntryId(entry.id)} />
        ) : null}
      </div>
    );
  }

  function renderPriorityMeta(priority: ShoppingPriority) {
    if (priority === "URGENT") {
      return <span className="ds-shopping-priority ds-shopping-priority--urgent">Срочно</span>;
    }

    return <span className="ds-shopping-priority">Купить</span>;
  }

  return (
    <section className="stack">
      <SectionHeader
        title="Покупки"
        subtitle={shoppingList.length ? `${shoppingList.length} активных` : "Пусто"}
        actions={
          shoppingList.length ? (
            <Button size="compact" variant="ghost" onClick={handleClearCompleted}>
              Очистить
            </Button>
          ) : null
        }
      />

      <form className="ds-shopping-form" onSubmit={handleCreate}>
        <input
          aria-label="Разовая покупка"
          placeholder="Разовая покупка"
          value={manualShoppingTitle}
          disabled={isActionPending("shopping:add")}
          onChange={(event) => setManualShoppingTitle(event.target.value)}
        />
        <select
          aria-label="Категория покупки"
          value={manualShoppingCategoryId}
          disabled={isActionPending("shopping:add")}
          onChange={(event) => setManualShoppingCategoryId(event.target.value)}
        >
          <option value="">Без категории</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Приоритет покупки"
          value={manualShoppingPriority}
          disabled={isActionPending("shopping:add")}
          onChange={(event) => setManualShoppingPriority(event.target.value as ShoppingPriority)}
        >
          <option value="NORMAL">Купить</option>
          <option value="URGENT">Срочно</option>
        </select>
        <Button disabled={isActionPending("shopping:add") || !manualShoppingTitle.trim()} type="submit">
          {isActionPending("shopping:add") ? "Добавляем..." : "Добавить"}
        </Button>
      </form>

      {shoppingGroups.length ? (
        <div className="ds-shopping-groups">
          {shoppingGroups.map((group) => (
            <section className="ds-shopping-group" key={group.id}>
              <SectionHeader title={group.title} />
              <div className="ds-product-list">
                {group.entries.map((entry) =>
                  editingShoppingId === entry.id ? (
                    <form
                      className="ds-product-row__edit"
                      key={entry.id}
                      onSubmit={(event) => handleUpdate(entry, event)}
                    >
                      <input
                        aria-label="Новое название покупки"
                        value={editingShoppingTitle}
                        onChange={(event) => setEditingShoppingTitle(event.target.value)}
                      />
                      <Button size="compact" type="submit">
                        Сохранить
                      </Button>
                    </form>
                  ) : (
                    <ProductRow
                      key={entry.id}
                      actions={renderEntryActions(entry)}
                      meta={renderPriorityMeta(entry.priority)}
                      subtitle={getEntrySubtitle(entry)}
                      title={entry.title}
                    />
                  )
                )}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <EmptyState
          description="Добавьте разовые покупки или отметьте товары для покупки в категориях"
          icon={ShoppingCart}
          title="Список покупок пуст"
        />
      )}

      <BottomSheet
        show={activeEntryId !== null}
        title={activeEntry?.title ?? ""}
        onClose={() => setActiveEntryId(null)}
      >
        {activeEntry ? (
          <div className="ds-bottom-sheet__actions">
            <button
              className="ds-bottom-sheet__action"
              type="button"
              onClick={() => {
                setEditingShoppingId(activeEntry.id);
                setEditingShoppingTitle(activeEntry.title);
                setActiveEntryId(null);
              }}
            >
              <Pencil aria-hidden="true" size={18} />
              Редактировать
            </button>
            <button
              className="ds-bottom-sheet__action ds-bottom-sheet__action--danger"
              type="button"
              onClick={() => handleDelete(activeEntry)}
            >
              <Trash2 aria-hidden="true" size={18} />
              Удалить
            </button>
          </div>
        ) : null}
      </BottomSheet>
    </section>
  );
}
