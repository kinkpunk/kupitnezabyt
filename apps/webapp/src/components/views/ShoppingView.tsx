"use client";

import { Archive, ListPlus, Pencil, Save, Search, ShoppingBasket, Trash2 } from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";

import { formatError } from "../../lib/format";
import type { Category, Item, ShoppingListEntry } from "../../lib/types";
import { BottomSheet, EmptyState, ProductRow, ProductRowMoreButton, SearchField } from "../common";
import { Button } from "../ui/Button";
import { PurchaseCheckbox } from "../ui/PurchaseCheckbox";

const BOUGHT_LINGER_MS = 5000;

interface BoughtEntryState {
  entry: ShoppingListEntry;
  previousStatus: Item["status"] | undefined;
  previousLastBoughtAt: string | null;
  groupIndex: number;
  position: number;
}

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
  onUndoCompleteShoppingListItem,
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
  onUndoCompleteShoppingListItem: (
    shoppingListItemId: string,
    previousStatus: Item["status"] | undefined,
    previousLastBoughtAt: string | null
  ) => Promise<void>;
  onEditItemEntry: (item: Item) => void;
  onArchiveItem: (item: Item) => Promise<void>;
  setError: (message: string | null) => void;
  isActionPending: (key: string) => boolean;
}) {
  const [activeEntryId, setActiveEntryId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [boughtEntries, setBoughtEntries] = useState<ReadonlyMap<string, BoughtEntryState>>(
    new Map()
  );
  const [restoringEntryIds, setRestoringEntryIds] = useState<ReadonlySet<string>>(new Set());
  const boughtTimersRef = useRef<Map<string, number>>(new Map());
  const completionPromisesRef = useRef<Map<string, Promise<boolean>>>(new Map());
  const activeEntry = useMemo(
    () => shoppingList.find((entry) => entry.id === activeEntryId) ?? null,
    [shoppingList, activeEntryId]
  );

  useEffect(() => {
    const timers = boughtTimersRef.current;
    return () => {
      timers.forEach((timerId) => window.clearTimeout(timerId));
    };
  }, []);

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

  const displayGroups = useMemo(() => {
    if (boughtEntries.size === 0) {
      return visibleGroups;
    }

    const groups = visibleGroups.map((group) => ({ ...group, entries: [...group.entries] }));
    const groupIndexMap = new Map(groups.map((group, index) => [group.id, index]));
    for (const { entry, groupIndex, position } of boughtEntries.values()) {
      const groupId = entry.category?.id ?? "manual";
      let index = groupIndexMap.get(groupId);
      if (index === undefined) {
        // The last open entry of a group was just bought, so the group fell out
        // of the shopping list. Recreate it at its original place to keep the
        // bought row where the user tapped it.
        const recreated = {
          id: groupId,
          title: entry.category?.name ?? "Без категории",
          entries: []
        };
        index = Math.min(groupIndex, groups.length);
        groups.splice(index, 0, recreated);
        groupIndexMap.clear();
        groups.forEach((group, groupPosition) => groupIndexMap.set(group.id, groupPosition));
      }
      const group = groups[index]!;
      if (group.entries.some((candidate) => candidate.id === entry.id)) {
        continue;
      }
      group.entries.splice(Math.min(position, group.entries.length), 0, entry);
    }
    return groups;
  }, [visibleGroups, boughtEntries]);

  function removeBoughtEntry(entryId: string) {
    const timerId = boughtTimersRef.current.get(entryId);
    if (timerId !== undefined) {
      window.clearTimeout(timerId);
      boughtTimersRef.current.delete(entryId);
    }
    setBoughtEntries((current) => {
      if (!current.has(entryId)) {
        return current;
      }
      const next = new Map(current);
      next.delete(entryId);
      return next;
    });
  }

  function findEntryPosition(entry: ShoppingListEntry): { groupIndex: number; position: number } {
    const groupId = entry.category?.id ?? "manual";
    const groupIndex = visibleGroups.findIndex((group) => group.id === groupId);
    if (groupIndex < 0) {
      return { groupIndex: Number.MAX_SAFE_INTEGER, position: Number.MAX_SAFE_INTEGER };
    }
    const index = visibleGroups[groupIndex]!.entries.findIndex(
      (candidate) => candidate.id === entry.id
    );
    return { groupIndex, position: index >= 0 ? index : Number.MAX_SAFE_INTEGER };
  }

  function registerBoughtEntry(
    entry: ShoppingListEntry,
    location: { groupIndex: number; position: number }
  ) {
    const existingTimerId = boughtTimersRef.current.get(entry.id);
    if (existingTimerId !== undefined) {
      window.clearTimeout(existingTimerId);
    }
    const timerId = window.setTimeout(() => removeBoughtEntry(entry.id), BOUGHT_LINGER_MS);
    boughtTimersRef.current.set(entry.id, timerId);
    setBoughtEntries((current) => {
      const next = new Map(current);
      next.set(entry.id, {
        entry,
        previousStatus: entry.item?.status,
        previousLastBoughtAt: entry.item?.lastBoughtAt ?? null,
        groupIndex: location.groupIndex,
        position: location.position
      });
      return next;
    });
  }

  function handleComplete(entry: ShoppingListEntry) {
    if (boughtTimersRef.current.has(entry.id) || boughtEntries.has(entry.id)) {
      return;
    }
    const location = findEntryPosition(entry);
    registerBoughtEntry(entry, location);
    const request = onCompleteShoppingListItem(entry)
      .then(() => true)
      .catch((caughtError: unknown) => {
        removeBoughtEntry(entry.id);
        setError(formatError(caughtError));
        return false;
      })
      .finally(() => {
        completionPromisesRef.current.delete(entry.id);
      });
    completionPromisesRef.current.set(entry.id, request);
  }

  function clearRestoringEntry(entryId: string) {
    setRestoringEntryIds((current) => {
      if (!current.has(entryId)) {
        return current;
      }
      const next = new Set(current);
      next.delete(entryId);
      return next;
    });
  }

  function handleUndoBought(entryId: string) {
    const bought = boughtEntries.get(entryId);
    if (!bought) {
      return;
    }
    setRestoringEntryIds((current) => new Set(current).add(entryId));
    removeBoughtEntry(entryId);
    const pendingCompletion = completionPromisesRef.current.get(entryId);
    void (pendingCompletion ?? Promise.resolve(true)).then((completed) => {
      if (!completed) {
        // The completion failed and the row already rolled back to the checkbox.
        clearRestoringEntry(entryId);
        return;
      }
      void onUndoCompleteShoppingListItem(entryId, bought.previousStatus, bought.previousLastBoughtAt)
        .catch((caughtError: unknown) => setError(formatError(caughtError)));
    });
  }

  function handleUpdate(entry: ShoppingListEntry, event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void onUpdateManualShoppingItem(entry).catch((caughtError) => setError(formatError(caughtError)));
  }

  function handleDelete(entry: ShoppingListEntry) {
    void onDeleteManualShoppingItem(entry).catch((caughtError) => setError(formatError(caughtError)));
    setActiveEntryId(null);
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
    if (boughtEntries.has(entry.id)) {
      return (
        <div className="ds-shopping-actions ds-shopping-actions--bought">
          <span className="ds-shopping-actions__bought" role="status" aria-label="Куплено">
            Куплено
          </span>
          <button
            type="button"
            className="ds-shopping-actions__undo"
            onClick={() => handleUndoBought(entry.id)}
          >
            Отмена
          </button>
        </div>
      );
    }

    const isRestoring = restoringEntryIds.has(entry.id);
    return (
      <div
        className={
          isRestoring ? "ds-shopping-actions ds-shopping-actions--restoring" : "ds-shopping-actions"
        }
        onAnimationEnd={isRestoring ? () => clearRestoringEntry(entry.id) : undefined}
      >
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
            variant="accent"
            disabled={isActionPending("shopping:add") || !manualShoppingTitle.trim()}
          >
            <ListPlus aria-hidden="true" size={16} />
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

      {shoppingGroups.length === 0 && !searchQuery.trim() ? null : (
        <div className="ds-panel-header">
          <div className="ds-panel-header__row">
            <div className="ds-panel-header__row-actions">
              <Button
                aria-label="Добавить покупку"
                className="ds-button--compact ds-panel-header__add"
                variant="solid"
                onClick={() => setShowShoppingForm(true)}
              >
                <ListPlus aria-hidden="true" size={18} />
                <span aria-hidden="true" className="ds-panel-header__add-label">
                  <span className="ds-panel-header__add-label-full">Добавить покупку</span>
                  <span className="ds-panel-header__add-label-short">Покупка</span>
                </span>
              </Button>
            </div>
          </div>
        </div>
      )}

      {displayGroups.length ? (
        <div className="ds-shopping-groups">
          {displayGroups.map((group) => (
            <section className="ds-shopping-group" key={group.id}>
              <h2 className="ds-shopping-group__title">
                <span className="ds-shopping-group__title-text">{group.title}</span>
                <span className="ds-shopping-group__count">{group.entries.length}</span>
              </h2>
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
                        <Save aria-hidden="true" size={16} />
                        Сохранить
                      </Button>
                    </form>
                  ) : (
                    <ProductRow
                      key={entry.id}
                      actions={renderEntryActions(entry)}
                      subtitle={group.id === "manual" ? getEntrySubtitle(entry) : undefined}
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
