"use client";

import type { ItemStatus } from "@kupitnezabyt/shared";
import {
  Archive,
  ArrowDown,
  ArrowUp,
  Bell,
  EyeOff,
  FolderPlus,
  GripVertical,
  ListOrdered,
  ListPlus,
  PackagePlus,
  Pencil,
  Plus,
  Save,
  X
} from "lucide-react";
import React, { useMemo, useState } from "react";

import type { CategorySortMode } from "../../lib/api";
import { formatDate, formatError } from "../../lib/format";
import { getReminderDraftKey } from "../../lib/reminder-draft";
import type { Category, Item, RecommendationSuggestion } from "../../lib/types";
import {
  categoryTriggerItemStatus,
  itemStatusToUiStatus,
  nextUiStatus,
  uiStatusToItemStatus
} from "../../lib/ui";
import {
  BottomSheet,
  ChipTabs,
  EmptyState,
  PanelHeader,
  ProductRow,
  ProductRowMoreButton,
  SearchField,
  type CategoryStatusFilter
} from "../common";
import { ReminderFields, type ReminderFieldsValue } from "../ui/ReminderFields";
import { ReminderSettingsSheet } from "../ui/ReminderSettingsSheet";
import type { ReminderSettingEntity, ReminderSettingInput } from "../ui/ReminderSettingsSheet";
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
  categorySortMode,
  visibleItems,
  visibleRecommendations,
  recommendationSourceItemName,
  canWriteActiveWorkspace,
  searchQuery,
  onSearchQueryChange,
  onSearch,
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
  onSaveReminderSetting,
  savingReminderKeys,
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
  categorySortMode: CategorySortMode;
  visibleItems: Item[];
  visibleRecommendations: RecommendationSuggestion[];
  recommendationSourceItemName: string | null;
  canWriteActiveWorkspace: boolean;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  onSearch: () => Promise<void>;
  onSelectCategory: (categoryId: string) => void;
  onCreateCategory: (input: ReminderSettingInput) => Promise<void>;
  onCreateItem: (input: ReminderSettingInput) => Promise<void>;
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
  onSaveReminderSetting: (
    entityType: "CATEGORY" | "ITEM",
    entityId: string,
    input: ReminderSettingInput
  ) => Promise<void>;
  savingReminderKeys: string[];
  setError: (message: string | null) => void;
  isActionPending: (key: string) => boolean;
}) {
  const [sheetItemId, setSheetItemId] = useState<string | null>(null);
  const [activeRecommendationId, setActiveRecommendationId] = useState<string | null>(null);
  const emptyReminderValue: ReminderFieldsValue = { usageCycleDays: null, reminderEnabled: false };
  const [categoryReminder, setCategoryReminder] = useState<ReminderFieldsValue>(emptyReminderValue);
  const [itemReminder, setItemReminder] = useState<ReminderFieldsValue>(emptyReminderValue);
  const [isReordering, setIsReordering] = useState(false);
  const [statusFilter, setStatusFilter] = useState<CategoryStatusFilter>("all");
  const [reminderEntity, setReminderEntity] = useState<ReminderSettingEntity | null>(null);

  React.useEffect(() => {
    setStatusFilter("all");
  }, [selectedCategory?.id]);

  const sheetItem = useMemo(
    () => visibleItems.find((item) => item.id === sheetItemId) ?? null,
    [visibleItems, sheetItemId]
  );
  const sheetItemIndex = useMemo(
    () => (sheetItem ? visibleItems.findIndex((item) => item.id === sheetItem.id) : -1),
    [visibleItems, sheetItem]
  );
  const activeRecommendation = useMemo(
    () =>
      visibleRecommendations.find((recommendation) => recommendation.id === activeRecommendationId) ??
      null,
    [visibleRecommendations, activeRecommendationId]
  );

  const { inStockCount, needBuyCount, lowCount } = useMemo(
    () => ({
      inStockCount: visibleItems.filter((item) => item.status === "IN_STOCK").length,
      needBuyCount: visibleItems.filter((item) => item.status === "NEED_BUY").length,
      lowCount: visibleItems.filter((item) => item.status === "LOW").length
    }),
    [visibleItems]
  );

  const filteredItems = useMemo(() => {
    if (statusFilter === "all") {
      return visibleItems;
    }
    const statusByFilter: Record<Exclude<CategoryStatusFilter, "all">, Item["status"]> = {
      in_stock: "IN_STOCK",
      low: "LOW",
      need_buy: "NEED_BUY"
    };
    return visibleItems.filter((item) => item.status === statusByFilter[statusFilter]);
  }, [statusFilter, visibleItems]);

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
    setSheetItemId(null);
  }

  function openItemReminderSettings(item: Item) {
    setReminderEntity({
      id: item.id,
      entityType: "ITEM",
      name: item.name,
      usageCycleDays: item.usageCycleDays,
      reminderEnabled: item.reminderEnabled
    });
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

      <BottomSheet
        show={showCategoryForm}
        title="Новая категория"
        onClose={() => {
          setCategoryReminder(emptyReminderValue);
          setShowCategoryForm(false);
        }}
      >
        <form
          className="ds-bottom-sheet__create-form"
          onSubmit={(event) => {
            event.preventDefault();
            void onCreateCategory(categoryReminder)
              .then(() => setCategoryReminder(emptyReminderValue))
              .catch((caughtError) => setError(formatError(caughtError)));
          }}
        >
          <input
            aria-label="Название категории"
            placeholder="Название категории"
            value={categoryName}
            disabled={isActionPending("category:create")}
            onChange={(event) => setCategoryName(event.target.value)}
          />
          <ReminderFields
            idPrefix="category-create"
            disabled={isActionPending("category:create")}
            value={categoryReminder}
            onChange={setCategoryReminder}
          />
          <Button
            type="submit"
            disabled={isActionPending("category:create") || !categoryName.trim()}
            variant="accent"
          >
            <ListPlus aria-hidden="true" size={16} />
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
        trailing={
          <Button
            aria-label="Новая категория"
            size="compact"
            title="Новая категория"
            variant="icon"
            onClick={() => setShowCategoryForm(true)}
          >
            <Plus aria-hidden="true" size={18} />
          </Button>
        }
        onSelect={onSelectCategory}
      />

      {selectedCategory ? (
        <>
          <PanelHeader
            key={selectedCategory.id}
            total={visibleItems.length}
            inStock={inStockCount}
            needBuy={needBuyCount}
            low={lowCount}
            filter={statusFilter}
            disabled={selectedCategory.itemCount === 0}
            onFilterChange={setStatusFilter}
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
            onOpenReminderSettings={() =>
              setReminderEntity({
                id: selectedCategory.id,
                entityType: "CATEGORY",
                name: selectedCategory.name,
                usageCycleDays: selectedCategory.usageCycleDays,
                reminderEnabled: selectedCategory.reminderEnabled
              })
            }
            onAddItem={
              isReordering || (visibleItems.length === 0 && statusFilter === "all")
                ? undefined
                : () => setShowItemForm(true)
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
                    <div className="recommendation-row__body">
                      <h3>{recommendation.suggestedItem}</h3>
                      <span>{recommendation.categoryHint ?? "Категория исходного товара"}</span>
                    </div>
                    <div className="recommendation-row__actions">
                      <Button
                        className="ds-button--compact"
                        disabled={isActionPending(`recommendation:add:${recommendation.id}`)}
                        variant="accent"
                        onClick={() =>
                          void onAcceptRecommendation(recommendation).catch((caughtError) =>
                            setError(formatError(caughtError))
                          )
                        }
                      >
                        {isActionPending(`recommendation:add:${recommendation.id}`)
                          ? "Добавляем..."
                          : "Добавить"}
                      </Button>
                      <ProductRowMoreButton
                        onClick={() => setActiveRecommendationId(recommendation.id)}
                      />
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          <div className="ds-product-list">
            {filteredItems.length ? (
              filteredItems.map((item) =>
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
                    <Button size="compact" type="submit">
                      <Save aria-hidden="true" size={16} />
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
            ) : statusFilter === "all" ? (
              <EmptyState
                actionLabel="Добавить товар"
                description="Добавьте первый товар в эту категорию."
                icon={PackagePlus}
                title="В категории пусто"
                onAction={() => setShowItemForm(true)}
              />
            ) : (
              <p className="ds-empty">Нет товаров с таким статусом.</p>
            )}
          </div>

          <BottomSheet
            show={showItemForm}
            title="Новый товар"
            onClose={() => {
              setItemReminder(emptyReminderValue);
              setShowItemForm(false);
            }}
          >
            <form
              className="ds-bottom-sheet__create-form"
              onSubmit={(event) => {
                event.preventDefault();
                void onCreateItem(itemReminder)
                  .then(() => setItemReminder(emptyReminderValue))
                  .catch((caughtError) =>
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
              <ReminderFields
                idPrefix="item-create"
                disabled={isActionPending("item:create")}
                value={itemReminder}
                onChange={setItemReminder}
              />
              <Button
                type="submit"
                disabled={isActionPending("item:create") || !itemName.trim()}
                variant="accent"
              >
                <ListPlus aria-hidden="true" size={16} />
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
                    className="ds-bottom-sheet__action"
                    type="button"
                    onClick={() => sheetItem && openItemReminderSettings(sheetItem)}
                  >
                    <Bell aria-hidden="true" size={18} />
                    Напоминание о проверке
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

          <BottomSheet
            show={activeRecommendation !== null}
            title={activeRecommendation?.suggestedItem ?? ""}
            onClose={() => setActiveRecommendationId(null)}
          >
            {activeRecommendation ? (
              <div className="ds-bottom-sheet__actions">
                <button
                  className="ds-bottom-sheet__action"
                  type="button"
                  onClick={() => {
                    void onDismissRecommendation(activeRecommendation).catch((caughtError) =>
                      setError(formatError(caughtError))
                    );
                    setActiveRecommendationId(null);
                  }}
                >
                  <X aria-hidden="true" size={18} />
                  Не нужно
                </button>
                <button
                  className="ds-bottom-sheet__action"
                  type="button"
                  onClick={() => {
                    void onHideSimilarRecommendations(activeRecommendation).catch(
                      (caughtError) => setError(formatError(caughtError))
                    );
                    setActiveRecommendationId(null);
                  }}
                >
                  <EyeOff aria-hidden="true" size={18} />
                  Скрыть похожие
                </button>
              </div>
            ) : null}
          </BottomSheet>

          <ReminderSettingsSheet
            entity={reminderEntity}
            isSaving={
              reminderEntity
                ? savingReminderKeys.includes(
                    getReminderDraftKey(reminderEntity.entityType, reminderEntity.id)
                  )
                : false
            }
            onClose={() => setReminderEntity(null)}
            onSave={(input) => {
              if (!reminderEntity) {
                return Promise.resolve();
              }

              return onSaveReminderSetting(
                reminderEntity.entityType,
                reminderEntity.id,
                input
              );
            }}
          />
        </>
      ) : (
        <EmptyState
          actionLabel="Создать категорию"
          description="Создайте категорию, чтобы добавить первый товар."
          icon={FolderPlus}
          title="Нет категорий"
          onAction={() => setShowCategoryForm(true)}
        />
      )}
    </section>
  );
}
