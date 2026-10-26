"use client";

import { Archive, Pencil, Plus, Search, ShoppingBasket, Trash2 } from "lucide-react";
import React, { useMemo, useState } from "react";

import { formatError } from "../../lib/format";
import type { Category, Item, ShoppingListEntry } from "../../lib/types";
import { BottomSheet, EmptyState, ProductRow, ProductRowMoreButton, SearchField } from "../common";
import { Button } from "../ui/Button";
import { PurchaseCheckbox } from "../ui/PurchaseCheckbox";

export function ShoppingView({
  shoppingList,
  shoppingGroups,
  categories,
  manualShoppingTitle,
  setManualShoppingTitle,
  manualShoppingCategoryId,
  setManualShoppingCategoryId,
  showShoppingForm,
  setShowShoppingForm,
  editingShoppingId,
  setEditingShoppingId,
  editingShoppingTitle,
  setEditingShoppingTitle,
  onCreateManualShoppingItem,
  onUpdateManualShoppingItem,
  onDeleteManualShoppingItem,
  onCompleteShoppingListItem,
  onEditItemEntry,
  onArchiveItem,
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
  showShoppingForm: boolean;
  setShowShoppingForm: (value: boolean | ((current: boolean) => boolean)) => void;
  editingShoppingId: string | null;
  setEditingShoppingId: (value: string | null) => void;
  editingShoppingTitle: string;
  setEditingShoppingTitle: (value: string) => void;
  onCreateManualShoppingItem: () => Promise<void>;
  onUpdateManualShoppingItem: (entry: ShoppingListEntry) => Promise<void>;
  onDeleteManualShoppingItem: (entry: ShoppingListEntry) => Promise<void>;
  onCompleteShoppingListItem: (entry: ShoppingListEntry) => Promise<void>;
  onEditItemEntry: (item: Item) => void;
  onArchiveItem: (item: Item) => Promise<void>;
  setError: (message: string | null) => void;
  isActionPending: (key: string) => boolean;
}) {
  const [activeEntryId, setActiveEntryId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const activeEntry = useMemo(
    () => shoppingList.find((entry) => entry.id === activeEntryId) ?? null,
    [shoppingList, activeEntryId]
  );

  const visibleGroups = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return shoppingGroups;
    }
    return shoppingGroups
      .map((group) => ({
        ...group,
        entries: group.entries.filter(
          (entry) =>
            entry.title.toLowerCase().includes(query) ||
            (entry.category?.name ?? "").toLowerCase().includes(query)
        )
      }))
      .filter((group) => group.entries.length > 0);
  }, [shoppingGroups, searchQuery]);

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

  function handleArchive(entry: ShoppingListEntry) {
    if (!entry.item) {
      return;
    }
    void onArchiveItem(entry.item).catch((caughtError) => setError(formatError(caughtError)));
    setActiveEntryId(null);
  }

  function getEntrySubtitle(entry: ShoppingListEntry): string {
    return entry.category?.name ?? (entry.itemId ? "Отслеживаемый товар" : "Разовая позиция");
  }

  function renderEntryActions(entry: ShoppingListEntry) {
    return (
      <div className="ds-shopping-actions">
        <PurchaseCheckbox
          pending={isActionPending(`shopping:bought:${entry.id}`)}
          onMark={() => handleComplete(entry)}
        />
        <span className="ds-shopping-actions__more">
          <ProductRowMoreButton onClick={() => setActiveEntryId(entry.id)} />
        </span>
      </div>
    );
  }

  return (
    <section className="stack">
      <BottomSheet
        show={showShoppingForm}
        title="Новая покупка"
        onClose={() => setShowShoppingForm(false)}
      >
        <form
          className="ds-bottom-sheet__create-form"
          onSubmit={(event) => {
            event.preventDefault();
            void onCreateManualShoppingItem().catch((caughtError) =>
              setError(formatError(caughtError))
            );
          }}
        >
          <input
            aria-label="Разовая покупка"
            disabled={isActionPending("shopping:add")}
            placeholder="Разовая покупка"
            value={manualShoppingTitle}
            onChange={(event) => setManualShoppingTitle(event.target.value)}
          />
          <select
            aria-label="Категория покупки"
            disabled={isActionPending("shopping:add")}
            value={manualShoppingCategoryId}
            onChange={(event) => setManualShoppingCategoryId(event.target.value)}
          >
            <option value="">Без категории</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          <Button
            type="submit"
            disabled={isActionPending("shopping:add") || !manualShoppingTitle.trim()}
          >
            {isActionPending("shopping:add") ? "Добавляем..." : "Добавить"}
          </Button>
        </form>
      </BottomSheet>

      <form
        className="ds-shopping-view__search"
        role="search"
        onSubmit={(event) => event.preventDefault()}
      >
        <SearchField
          label="Поиск по покупкам"
          placeholder="Найти покупку"
          value={searchQuery}
          onChange={setSearchQuery}
        />
      </form>

      {visibleGroups.length ? (
        <div className="ds-shopping-groups">
          {visibleGroups.map((group) => (
            <section className="ds-shopping-group" key={group.id}>
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
                      subtitle={getEntrySubtitle(entry)}
                      title={entry.title}
                    />
                  )
                )}
              </div>
            </section>
          ))}
        </div>
      ) : searchQuery.trim() ? (
        <EmptyState
          description="Попробуйте изменить запрос"
          icon={Search}
          title="Ничего не найдено"
        />
      ) : (
        <EmptyState
          actionLabel="Добавить покупку"
          description="Добавьте разовые покупки или отметьте товары для покупки в категориях"
          icon={ShoppingBasket}
          title="Список покупок пуст"
          onAction={() => setShowShoppingForm(true)}
        />
      )}

      {shoppingGroups.length === 0 && !searchQuery.trim() ? null : (
        <button
          className="ds-add-item-row"
          type="button"
          onClick={() => setShowShoppingForm(true)}
        >
          <Plus aria-hidden="true" size={18} />
          Добавить покупку
        </button>
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
                if (activeEntry.item) {
                  onEditItemEntry(activeEntry.item);
                  setActiveEntryId(null);
                  return;
                }
                setEditingShoppingId(activeEntry.id);
                setEditingShoppingTitle(activeEntry.title);
                setActiveEntryId(null);
              }}
            >
              <Pencil aria-hidden="true" size={18} />
              Редактировать
            </button>
            {activeEntry.item ? (
              <button
                className="ds-bottom-sheet__action ds-bottom-sheet__action--danger"
                type="button"
                onClick={() => handleArchive(activeEntry)}
              >
                <Archive aria-hidden="true" size={18} />
                В архив
              </button>
            ) : (
              <button
                className="ds-bottom-sheet__action ds-bottom-sheet__action--danger"
                type="button"
                onClick={() => handleDelete(activeEntry)}
              >
                <Trash2 aria-hidden="true" size={18} />
                Удалить
              </button>
            )}
          </div>
        ) : null}
      </BottomSheet>
    </section>
  );
}
