"use client";

import type { ItemImportance, ItemStatus } from "@kupitnezabyt/shared";
import {
  Archive,
  ArrowDown,
  ArrowUp,
  GripVertical,
  ListOrdered,
  Pencil,
  Plus,
  Users
} from "lucide-react";
import React, { useMemo, useState } from "react";

import type { CategorySortMode } from "../../lib/api";
import { formatDate, formatError } from "../../lib/format";
import type { Category, Item, RecommendationSuggestion } from "../../lib/types";
import {
  categoryTriggerItemStatus,
  importanceLabels,
  importanceOptions,
  itemStatusToUiStatus,
  nextUiStatus,
  uiStatusToItemStatus
} from "../../lib/ui";
import {
  BottomSheet,
  ChipTabs,
  FAB,
  PanelHeader,
  ProductRow,
  ProductRowMoreButton,
  SearchField
} from "../common";
import { Button } from "../ui/Button";

export function CategoriesView({
  categories,
  selectedCategory,
  categoryName,
  setCategoryName,
  showCategoryForm,
  setShowCategoryForm,
  itemName,
  setItemName,
  showItemForm,
  setShowItemForm,
  editingItemId,
  setEditingItemId,
  editingItemName,
  setEditingItemName,
  editingItemImportance,
  setEditingItemImportance,
  categorySortMode,
  visibleItems,
  visibleRecommendations,
  recommendationSourceItemName,
  canWriteActiveWorkspace,
  showShareEntryPoint,
  searchQuery,
  onSearchQueryChange,
  onSearch,
  onSelectSettings,
  onSelectCategory,
  onCreateCategory,
  onCreateItem,
  onSetStatus,
  onCategorySortModeChange,
  onMoveItem,
  onAcceptRecommendation,
  onDismissRecommendation,
  onHideSimilarRecommendations,
  onUpdateItem,
  onArchiveItem,
  onArchiveSelectedCategory,
  onStartCategoryCheck,
  setError,
  isActionPending
}: {
  categories: Category[];
  selectedCategory: Category | null | undefined;
  categoryName: string;
  setCategoryName: (value: string) => void;
  showCategoryForm: boolean;
  setShowCategoryForm: (value: boolean | ((current: boolean) => boolean)) => void;
  itemName: string;
  setItemName: (value: string) => void;
  showItemForm: boolean;
  setShowItemForm: (value: boolean | ((current: boolean) => boolean)) => void;
  editingItemId: string | null;
  setEditingItemId: (value: string | null) => void;
  editingItemName: string;
  setEditingItemName: (value: string) => void;
  editingItemImportance: ItemImportance;
  setEditingItemImportance: (value: ItemImportance) => void;
  categorySortMode: CategorySortMode;
  visibleItems: Item[];
  visibleRecommendations: RecommendationSuggestion[];
  recommendationSourceItemName: string | null;
  canWriteActiveWorkspace: boolean;
  showShareEntryPoint: boolean;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  onSearch: () => Promise<void>;
  onSelectSettings: () => void;
  onSelectCategory: (categoryId: string) => void;
  onCreateCategory: () => Promise<void>;
  onCreateItem: () => Promise<void>;
  onSetStatus: (item: Item, status: ItemStatus) => Promise<void>;
  onCategorySortModeChange: (mode: CategorySortMode) => Promise<void>;
  onMoveItem: (item: Item, direction: "up" | "down") => Promise<void>;
  onAcceptRecommendation: (recommendation: RecommendationSuggestion) => Promise<void>;
  onDismissRecommendation: (recommendation: RecommendationSuggestion) => Promise<void>;
  onHideSimilarRecommendations: (recommendation: RecommendationSuggestion) => Promise<void>;
  onUpdateItem: (item: Item) => Promise<void>;
  onArchiveItem: (item: Item) => Promise<void>;
  onArchiveSelectedCategory: () => Promise<void>;
  onStartCategoryCheck: () => Promise<void>;
  setError: (message: string | null) => void;
  isActionPending: (key: string) => boolean;
}) {
  const [sheetItemId, setSheetItemId] = useState<string | null>(null);
  const [isReordering, setIsReordering] = useState(false);

  const sheetItem = useMemo(
    () => visibleItems.find((item) => item.id === sheetItemId) ?? null,
    [visibleItems, sheetItemId]
  );
  const sheetItemIndex = useMemo(
    () => (sheetItem ? visibleItems.findIndex((item) => item.id === sheetItem.id) : -1),
    [visibleItems, sheetItem]
  );

  const boughtCount = useMemo(
    () => visibleItems.filter((item) => item.status === "IN_STOCK").length,
    [visibleItems]
  );

  function handleSearchSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void onSearch().catch((caughtError) => setError(formatError(caughtError)));
  }

  function handleStatusClick(item: Item) {
    const uiStatus = itemStatusToUiStatus(item.status);
    if (uiStatus === null) {
      return;
    }

    const nextStatus = nextUiStatus(uiStatus);
    void onSetStatus(item, uiStatusToItemStatus(nextStatus)).catch((caughtError) =>
      setError(formatError(caughtError))
    );
  }

  function handleStartEdit(item: Item) {
    setEditingItemId(item.id);
    setEditingItemName(item.name);
    setEditingItemImportance(item.importance);
    setSheetItemId(null);
  }

  function handleMove(direction: "up" | "down") {
    if (!sheetItem) {
      return;
    }

    void onMoveItem(sheetItem, direction).catch((caughtError) =>
      setError(formatError(caughtError))
    );
  }

  async function handleStartReorder() {
    if (categorySortMode !== "manual") {
      try {
        await onCategorySortModeChange("manual");
      } catch (caughtError) {
        setError(formatError(caughtError));
        return;
      }
    }

    setIsReordering(true);
    setSheetItemId(null);
  }

  async function handleSortByStatus() {
    if (categorySortMode === "status") {
      setSheetItemId(null);
      return;
    }

    try {
      await onCategorySortModeChange("status");
    } catch (caughtError) {
      setError(formatError(caughtError));
      return;
    }

    setSheetItemId(null);
  }

  function handleFinishReorder() {
    setIsReordering(false);
    setSheetItemId(null);
  }

  function handleArchiveSelectedItem() {
    if (!sheetItem) {
      return;
    }

    void onArchiveItem(sheetItem).catch((caughtError) => setError(formatError(caughtError)));
    setSheetItemId(null);
  }

  function getItemSubtitle(item: Item): string {
    return item.lastCheckedAt
      ? `Проверено ${formatDate(item.lastCheckedAt)}`
      : "Ещё не проверялось";
  }

  function getItemStatus(item: Item): "ok" | "warn" | "bad" | "paused" {
    return itemStatusToUiStatus(item.status) ?? "paused";
  }

  return (
    <section className="ds-categories-view">
      <form
        className="ds-categories-view__search"
        role="search"
        onSubmit={handleSearchSubmit}
      >
        <SearchField value={searchQuery} onChange={onSearchQueryChange} />
      </form>

      <div className="ds-categories-view__heading">
        <div>
          <h2 className="ds-categories-view__title">Категории</h2>
          <p className="ds-categories-view__meta">
            {categories.length ? `${categories.length} активных` : "Пока нет"}
          </p>
        </div>
        <div className="ds-categories-view__actions">
          {showShareEntryPoint ? (
            <Button
              aria-label="Поделиться списком"
              size="compact"
              title="Поделиться списком"
              variant="icon"
              onClick={onSelectSettings}
            >
              <Users aria-hidden="true" size={18} />
            </Button>
          ) : null}
          <Button
            aria-label="Новая категория"
            size="compact"
            title="Новая категория"
            variant="icon"
            onClick={() => setShowCategoryForm(true)}
          >
            <Plus aria-hidden="true" size={18} />
          </Button>
        </div>
      </div>

      <BottomSheet
        show={showCategoryForm}
        title="Новая категория"
        onClose={() => setShowCategoryForm(false)}
      >
        <form
          className="ds-bottom-sheet__create-form"
          onSubmit={(event) => {
            event.preventDefault();
            void onCreateCategory().catch((caughtError) => setError(formatError(caughtError)));
          }}
        >
          <input
            aria-label="Название категории"
            placeholder="Название категории"
            value={categoryName}
            disabled={isActionPending("category:create")}
            onChange={(event) => setCategoryName(event.target.value)}
          />
          <Button
            type="submit"
            disabled={isActionPending("category:create") || !categoryName.trim()}
          >
            {isActionPending("category:create") ? "Создаем..." : "Создать"}
          </Button>
        </form>
      </BottomSheet>

      <ChipTabs
        ariaLabel="Категории"
        items={categories.map((category) => ({
          id: category.id,
          label: category.name,
          warning: categoryTriggerItemStatus[category.aggregateStatus] !== null
        }))}
        selectedId={selectedCategory?.id ?? null}
        onSelect={onSelectCategory}
      />

      {selectedCategory ? (
        <>
          <PanelHeader
            done={boughtCount}
            total={visibleItems.length}
            disabled={selectedCategory.itemCount === 0}
            onArchive={() =>
              void onArchiveSelectedCategory().catch((caughtError) =>
                setError(formatError(caughtError))
              )
            }
            onCheck={() =>
              void onStartCategoryCheck().catch((caughtError) =>
                setError(formatError(caughtError))
              )
            }
          />

          {visibleRecommendations.length ? (
            <section className="recommendations" aria-label="Рекомендации">
              <div>
                <p className="eyebrow">Рекомендации</p>
                <h2>
                  {recommendationSourceItemName
                    ? `Вместе с "${recommendationSourceItemName}"`
                    : "Можно добавить"}
                </h2>
              </div>
              <div className="recommendation-list">
                {visibleRecommendations.map((recommendation) => (
                  <article className="recommendation-row" key={recommendation.id}>
                    <div>
                      <h3>{recommendation.suggestedItem}</h3>
                      <span>{recommendation.categoryHint ?? "Категория исходного товара"}</span>
                    </div>
                    <div className="ds-shopping-actions">
                      <button
                        className="ds-button ds-button--ghost ds-button--compact"
                        type="button"
                        onClick={() =>
                          void onDismissRecommendation(recommendation).catch((caughtError) =>
                            setError(formatError(caughtError))
                          )
                        }
                      >
                        Не нужно
                      </button>
                      <button
                        className="ds-button ds-button--ghost ds-button--compact"
                        type="button"
                        onClick={() =>
                          void onHideSimilarRecommendations(recommendation).catch((caughtError) =>
                            setError(formatError(caughtError))
                          )
                        }
                      >
                        Скрыть похожие
                      </button>
                      <button
                        className="ds-button ds-button--primary ds-button--compact"
                        type="button"
                        disabled={isActionPending(`recommendation:add:${recommendation.id}`)}
                        onClick={() =>
                          void onAcceptRecommendation(recommendation).catch((caughtError) =>
                            setError(formatError(caughtError))
                          )
                        }
                      >
                        {isActionPending(`recommendation:add:${recommendation.id}`)
                          ? "Добавляем..."
                          : "Добавить"}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          <div className="ds-product-list">
            {visibleItems.length ? (
              visibleItems.map((item) =>
                editingItemId === item.id ? (
                  <form
                    className="ds-product-row__edit"
                    key={item.id}
                    onSubmit={(event) => {
                      event.preventDefault();
                      void onUpdateItem(item).catch((caughtError) =>
                        setError(formatError(caughtError))
                      );
                    }}
                  >
                    <input
                      aria-label="Новое название товара"
                      value={editingItemName}
                      onChange={(event) => setEditingItemName(event.target.value)}
                    />
                    <select
                      aria-label={`Важность товара ${item.name}`}
                      value={editingItemImportance}
                      onChange={(event) =>
                        setEditingItemImportance(event.target.value as ItemImportance)
                      }
                    >
                      {importanceOptions.map((importance) => (
                        <option key={importance} value={importance}>
                          {importanceLabels[importance]}
                        </option>
                      ))}
                    </select>
                    <Button size="compact" type="submit">
                      Сохранить
                    </Button>
                  </form>
                ) : (
                  <ProductRow
                    key={item.id}
                    actions={
                      isReordering ? null : (
                        <ProductRowMoreButton onClick={() => setSheetItemId(item.id)} />
                      )
                    }
                    reorderHandle={isReordering}
                    status={isReordering ? undefined : getItemStatus(item)}
                    subtitle={getItemSubtitle(item)}
                    title={item.name}
                    onClick={isReordering ? () => setSheetItemId(item.id) : undefined}
                    onStatusClick={isReordering ? undefined : () => handleStatusClick(item)}
                  />
                )
              )
            ) : (
              <p className="ds-empty">Добавьте первый товар в эту категорию.</p>
            )}
          </div>

          <BottomSheet
            show={showItemForm}
            title="Новый товар"
            onClose={() => setShowItemForm(false)}
          >
            <form
              className="ds-bottom-sheet__create-form"
              onSubmit={(event) => {
                event.preventDefault();
                void onCreateItem().catch((caughtError) =>
                  setError(formatError(caughtError))
                );
              }}
            >
              <input
                aria-label="Название товара"
                placeholder="Название товара"
                value={itemName}
                disabled={isActionPending("item:create")}
                onChange={(event) => setItemName(event.target.value)}
              />
              <Button
                type="submit"
                disabled={isActionPending("item:create") || !itemName.trim()}
              >
                {isActionPending("item:create") ? "Добавляем..." : "Добавить"}
              </Button>
            </form>
          </BottomSheet>

          <BottomSheet
            show={sheetItemId !== null}
            title={sheetItem?.name ?? ""}
            onClose={() => setSheetItemId(null)}
          >
            <div className="ds-bottom-sheet__actions">
              {isReordering ? (
                <>
                  <button
                    className="ds-bottom-sheet__action"
                    disabled={
                      sheetItemIndex <= 0 || isActionPending(`item:reorder:${sheetItemId}`)
                    }
                    type="button"
                    onClick={() => handleMove("up")}
                  >
                    <ArrowUp aria-hidden="true" size={18} />
                    Вверх
                  </button>
                  <button
                    className="ds-bottom-sheet__action"
                    disabled={
                      sheetItemIndex === -1 ||
                      sheetItemIndex >= visibleItems.length - 1 ||
                      isActionPending(`item:reorder:${sheetItemId}`)
                    }
                    type="button"
                    onClick={() => handleMove("down")}
                  >
                    <ArrowDown aria-hidden="true" size={18} />
                    Вниз
                  </button>
                  <button
                    className="ds-bottom-sheet__action ds-bottom-sheet__action--active"
                    type="button"
                    onClick={handleFinishReorder}
                  >
                    Готово
                  </button>
                </>
              ) : (
                <>
                  {canWriteActiveWorkspace && visibleItems.length > 1 ? (
                    <button
                      className="ds-bottom-sheet__action"
                      type="button"
                      onClick={handleStartReorder}
                    >
                      <GripVertical aria-hidden="true" size={18} />
                      Изменить порядок
                    </button>
                  ) : null}
                  {categorySortMode === "manual" ? (
                    <button
                      className="ds-bottom-sheet__action"
                      type="button"
                      onClick={handleSortByStatus}
                    >
                      <ListOrdered aria-hidden="true" size={18} />
                      Сортировать по статусу
                    </button>
                  ) : null}
                  <button
                    className="ds-bottom-sheet__action"
                    type="button"
                    onClick={() => sheetItem && handleStartEdit(sheetItem)}
                  >
                    <Pencil aria-hidden="true" size={18} />
                    Редактировать
                  </button>
                  <button
                    className="ds-bottom-sheet__action ds-bottom-sheet__action--danger"
                    type="button"
                    onClick={handleArchiveSelectedItem}
                  >
                    <Archive aria-hidden="true" size={18} />
                    В архив
                  </button>
                </>
              )}
            </div>
          </BottomSheet>

          <FAB label="Новый товар" onClick={() => setShowItemForm(true)} />
        </>
      ) : (
        <p className="ds-empty">Создайте категорию, чтобы добавить первый товар.</p>
      )}
    </section>
  );
}
