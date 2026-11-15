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
import React, { useEffect, useMemo, useRef, useState } from "react";

import type { CategorySortMode } from "../../lib/api";
import { formatDate, formatError } from "../../lib/format";
import { getReminderDraftKey } from "../../lib/reminder-draft";
import type { Category, Item, RecommendationSuggestion } from "../../lib/types";
import {
  categoryStatusFilterToItemStatus,
  categoryTriggerItemStatus,
  itemStatusToUiStatus,
  nextUiStatus,
  uiStatusToItemStatus,
  type CategoryStatusFilter,
  type UiItemStatus
} from "../../lib/ui";
import {
  BottomSheet,
  ChipTabs,
  EmptyState,
  PanelHeader,
  ProductRow,
  ProductRowMoreButton,
  SearchField
} from "../common";
import { ReminderFields, type ReminderFieldsValue } from "../ui/ReminderFields";
import { ReminderSettingsSheet } from "../ui/ReminderSettingsSheet";
import type { ReminderSettingEntity, ReminderSettingInput } from "../ui/ReminderSettingsSheet";
import { Button } from "../ui/Button";

const REORDER_DRAG_THRESHOLD_PX = 10;
const REORDER_EDGE_SCROLL_PX = 56;
const SWIPE_ACTION_WIDTH_PX = 88;
const SWIPE_COMMIT_THRESHOLD_PX = 56;
const SWIPE_DRAG_THRESHOLD_PX = 10;

function matchesStatusFilter(item: Item, statusFilter: CategoryStatusFilter): boolean {
  return statusFilter === "all" || item.status === categoryStatusFilterToItemStatus[statusFilter];
}

function filterItemsByStatus(items: Item[], statusFilter: CategoryStatusFilter): Item[] {
  return statusFilter === "all"
    ? items
    : items.filter((item) => item.status === categoryStatusFilterToItemStatus[statusFilter]);
}

// Moves an item to a target position among the items visible under the active
// status filter; filtered-out items keep their relative positions. The full
// (unfiltered) order is always returned, so it can be committed to the API.
function applyDisplayIndexMove(
  items: Item[],
  statusFilter: CategoryStatusFilter,
  itemId: string,
  targetDisplayIndex: number
): Item[] {
  const displayed = items.filter((item) => matchesStatusFilter(item, statusFilter));
  const sourceDisplayIndex = displayed.findIndex((item) => item.id === itemId);
  const clampedTarget = Math.min(Math.max(targetDisplayIndex, 0), displayed.length - 1);
  if (sourceDisplayIndex < 0 || clampedTarget === sourceDisplayIndex) {
    return items;
  }
  const nextDisplayed = [...displayed];
  const [movedItem] = nextDisplayed.splice(sourceDisplayIndex, 1);
  nextDisplayed.splice(clampedTarget, 0, movedItem!);
  const queue = [...nextDisplayed];
  return items.map((item) => (matchesStatusFilter(item, statusFilter) ? queue.shift()! : item));
}

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
  statusFilter,
  onStatusFilterChange,
  onCreateCategory,
  onCreateItem,
  onSetStatus,
  onCategorySortModeChange,
  onReorderItems,
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
  statusFilter: CategoryStatusFilter;
  onStatusFilterChange: (filter: CategoryStatusFilter) => void;
  onCreateCategory: (input: ReminderSettingInput) => Promise<void>;
  onCreateItem: (input: ReminderSettingInput) => Promise<void>;
  onSetStatus: (item: Item, status: ItemStatus) => Promise<void>;
  onCategorySortModeChange: (mode: CategorySortMode) => Promise<void>;
  onReorderItems: (itemIds: string[]) => Promise<void>;
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
  const [reorderDraft, setReorderDraft] = useState<Item[] | null>(null);
  const [dragState, setDragState] = useState<{
    itemId: string;
    deltaY: number;
    sourceDisplayIndex: number;
    targetDisplayIndex: number;
  } | null>(null);
  const [reminderEntity, setReminderEntity] = useState<ReminderSettingEntity | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const reorderRowElementsRef = useRef(new Map<string, HTMLDivElement>());
  const reorderDragRef = useRef<{
    pointerId: number;
    itemId: string;
    startX: number;
    startY: number;
    sourceDisplayIndex: number;
    targetDisplayIndex: number;
    dragging: boolean;
    cancelled: boolean;
  } | null>(null);
  const reorderListenersRef = useRef<{
    move: (event: PointerEvent) => void;
    up: (event: PointerEvent) => void;
    cancel: () => void;
  } | null>(null);
  const suppressReorderClickRef = useRef(false);
  const [swipeState, setSwipeState] = useState<{ itemId: string; deltaX: number } | null>(null);
  const [hiddenItemIds, setHiddenItemIds] = useState<ReadonlySet<string>>(new Set());
  const swipeDragRef = useRef<{
    pointerId: number;
    item: Item;
    startX: number;
    startY: number;
    deltaX: number;
    swiping: boolean;
    cancelled: boolean;
  } | null>(null);
  const swipeListenersRef = useRef<{
    move: (event: PointerEvent) => void;
    up: (event: PointerEvent) => void;
    cancel: () => void;
  } | null>(null);
  const suppressSwipeClickRef = useRef(false);

  const sheetItem = useMemo(
    () => visibleItems.find((item) => item.id === sheetItemId) ?? null,
    [visibleItems, sheetItemId]
  );

  // В режиме переупорядочивания полный (нефильтрованный) порядок берётся из
  // локального черновика, пока пользователь не нажал «Готово»; видимый список —
  // черновик под активным фильтром.
  const orderedItems = useMemo(
    () => (isReordering ? (reorderDraft ?? visibleItems) : visibleItems),
    [isReordering, reorderDraft, visibleItems]
  );
  const displayedItems = useMemo(
    () =>
      filterItemsByStatus(orderedItems, statusFilter).filter((item) => !hiddenItemIds.has(item.id)),
    [orderedItems, statusFilter, hiddenItemIds]
  );
  const sheetItemIndex = useMemo(
    () => (sheetItem ? displayedItems.findIndex((item) => item.id === sheetItem.id) : -1),
    [displayedItems, sheetItem]
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

  function handleStatusSelect(item: Item, nextStatus: UiItemStatus) {
    if (itemStatusToUiStatus(item.status) === nextStatus) {
      return;
    }
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

  function handleDraftMove(itemId: string, direction: "up" | "down") {
    setReorderDraft((current) => {
      const base = current ?? visibleItems;
      const displayed = filterItemsByStatus(base, statusFilter);
      const sourceIndex = displayed.findIndex((item) => item.id === itemId);
      const targetIndex = direction === "up" ? sourceIndex - 1 : sourceIndex + 1;
      const next = applyDisplayIndexMove(base, statusFilter, itemId, targetIndex);
      return next === base ? current : next;
    });
  }

  function handleFinishReorder() {
    if (isActionPending("items:reorder")) {
      return;
    }
    const finalDraft = reorderDraft;
    setIsReordering(false);
    setSheetItemId(null);
    setReorderDraft(null);
    setDragState(null);
    detachReorderListeners();
    reorderDragRef.current = null;
    if (!finalDraft) {
      return;
    }
    const currentIds = visibleItems.map((item) => item.id);
    const draftIds = finalDraft.map((item) => item.id);
    const unchanged =
      draftIds.length === currentIds.length &&
      draftIds.every((id, index) => id === currentIds[index]);
    if (unchanged) {
      return;
    }
    void onReorderItems(draftIds).catch((caughtError) => setError(formatError(caughtError)));
  }

  function handleCancelReorder() {
    detachReorderListeners();
    reorderDragRef.current = null;
    setDragState(null);
    setIsReordering(false);
    setSheetItemId(null);
    setReorderDraft(null);
  }

  // Быстрая архивация без модального подтверждения: строка скрывается сразу
  // (оптимистично), undo живёт в тосте на уровне useAppState; при отказе API
  // строка возвращается, ошибка уже показана обработчиком.
  function archiveItemQuietly(item: Item) {
    setSwipeState(null);
    setHiddenItemIds((current) => new Set(current).add(item.id));
    void onArchiveItem(item)
      .catch(() => undefined)
      .finally(() => {
        setHiddenItemIds((current) => {
          if (!current.has(item.id)) {
            return current;
          }
          const next = new Set(current);
          next.delete(item.id);
          return next;
        });
      });
  }

  function detachSwipeListeners() {
    const listeners = swipeListenersRef.current;
    if (!listeners) {
      return;
    }
    window.removeEventListener("pointermove", listeners.move);
    window.removeEventListener("pointerup", listeners.up);
    window.removeEventListener("pointercancel", listeners.cancel);
    swipeListenersRef.current = null;
  }

  useEffect(() => () => {
    detachSwipeListeners();
  }, []);

  function handleSwipePointerDown(event: React.PointerEvent<HTMLDivElement>, item: Item) {
    if (event.pointerType === "mouse" && event.button !== 0) {
      return;
    }
    if (swipeDragRef.current) {
      detachSwipeListeners();
    }
    const drag = {
      pointerId: event.pointerId,
      item,
      startX: event.clientX,
      startY: event.clientY,
      deltaX: 0,
      swiping: false,
      cancelled: false
    };
    swipeDragRef.current = drag;
    setSwipeState(null);

    const handleMove = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== drag.pointerId || drag.cancelled) {
        return;
      }
      const dx = moveEvent.clientX - drag.startX;
      const dy = moveEvent.clientY - drag.startY;
      if (!drag.swiping) {
        if (Math.abs(dx) > SWIPE_DRAG_THRESHOLD_PX && Math.abs(dx) > Math.abs(dy)) {
          drag.swiping = true;
        } else if (Math.abs(dy) > SWIPE_DRAG_THRESHOLD_PX && Math.abs(dy) > Math.abs(dx)) {
          drag.cancelled = true;
          return;
        } else {
          return;
        }
      }
      moveEvent.preventDefault();
      drag.deltaX = Math.max(Math.min(dx, 0), -SWIPE_ACTION_WIDTH_PX);
      setSwipeState({ itemId: drag.item.id, deltaX: drag.deltaX });
    };

    const finishDrag = () => {
      detachSwipeListeners();
      swipeDragRef.current = null;
    };

    const handleUp = (upEvent: PointerEvent) => {
      if (upEvent.pointerId !== drag.pointerId) {
        return;
      }
      const wasSwiping = drag.swiping;
      const committed = drag.deltaX <= -SWIPE_COMMIT_THRESHOLD_PX;
      const draggedItem = drag.item;
      finishDrag();
      setSwipeState(null);
      if (!wasSwiping) {
        return;
      }
      // Клик-«отпускание» в конце свайпа не должен открывать bottom-sheet
      suppressSwipeClickRef.current = true;
      if (committed) {
        archiveItemQuietly(draggedItem);
      }
    };

    const handleCancel = () => {
      setSwipeState(null);
      finishDrag();
    };

    swipeListenersRef.current = { move: handleMove, up: handleUp, cancel: handleCancel };
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleCancel);
  }

  function handleSwipeClickCapture(event: React.MouseEvent<HTMLDivElement>) {
    if (!suppressSwipeClickRef.current) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    suppressSwipeClickRef.current = false;
  }

  function detachReorderListeners() {
    const listeners = reorderListenersRef.current;
    if (!listeners) {
      return;
    }
    window.removeEventListener("pointermove", listeners.move);
    window.removeEventListener("pointerup", listeners.up);
    window.removeEventListener("pointercancel", listeners.cancel);
    reorderListenersRef.current = null;
  }

  useEffect(() => () => {
    detachReorderListeners();
  }, []);

  function handleReorderPointerDown(event: React.PointerEvent<HTMLDivElement>, item: Item) {
    if (event.pointerType === "mouse" && event.button !== 0) {
      return;
    }
    if (reorderDragRef.current) {
      detachReorderListeners();
    }
    const sourceDisplayIndex = displayedItems.findIndex((current) => current.id === item.id);
    if (sourceDisplayIndex < 0) {
      return;
    }
    const drag = {
      pointerId: event.pointerId,
      itemId: item.id,
      startX: event.clientX,
      startY: event.clientY,
      sourceDisplayIndex,
      targetDisplayIndex: sourceDisplayIndex,
      dragging: false,
      cancelled: false
    };
    reorderDragRef.current = drag;

    // Обработчики намеренно захватывают displayedItems/statusFilter момента
    // начала жеста: во время drag они не меняются — черновик правится на pointerup.
    const handleMove = (moveEvent: PointerEvent) => {
      if (drag.pointerId !== moveEvent.pointerId || drag.cancelled) {
        return;
      }
      const deltaX = moveEvent.clientX - drag.startX;
      const deltaY = moveEvent.clientY - drag.startY;
      if (!drag.dragging) {
        if (
          Math.abs(deltaX) <= REORDER_DRAG_THRESHOLD_PX &&
          Math.abs(deltaY) <= REORDER_DRAG_THRESHOLD_PX
        ) {
          return;
        }
        if (Math.abs(deltaX) > Math.abs(deltaY)) {
          drag.cancelled = true; // горизонтальный жест отдаём горизонтальному скроллу
          return;
        }
        drag.dragging = true;
      }
      moveEvent.preventDefault();
      let insertionIndex = 0;
      for (const current of displayedItems) {
        const element = reorderRowElementsRef.current.get(current.id);
        if (!element) {
          continue;
        }
        const rect = element.getBoundingClientRect();
        if (moveEvent.clientY >= rect.top + rect.height / 2) {
          insertionIndex += 1;
        }
      }
      const lastIndex = displayedItems.length - 1;
      const target =
        insertionIndex > drag.sourceDisplayIndex ? insertionIndex - 1 : insertionIndex;
      drag.targetDisplayIndex = Math.min(Math.max(target, 0), lastIndex);
      setDragState({
        itemId: drag.itemId,
        deltaY,
        sourceDisplayIndex: drag.sourceDisplayIndex,
        targetDisplayIndex: drag.targetDisplayIndex
      });

      const container = listRef.current?.closest(".main-content");
      if (container) {
        const containerRect = container.getBoundingClientRect();
        if (moveEvent.clientY < containerRect.top + REORDER_EDGE_SCROLL_PX) {
          container.scrollTop -= Math.round(
            (containerRect.top + REORDER_EDGE_SCROLL_PX - moveEvent.clientY) / 4
          );
        } else if (moveEvent.clientY > containerRect.bottom - REORDER_EDGE_SCROLL_PX) {
          container.scrollTop += Math.round(
            (moveEvent.clientY - (containerRect.bottom - REORDER_EDGE_SCROLL_PX)) / 4
          );
        }
      }
    };

    const handleUp = (upEvent: PointerEvent) => {
      detachReorderListeners();
      reorderDragRef.current = null;
      if (drag.pointerId !== upEvent.pointerId || !drag.dragging || drag.cancelled) {
        return;
      }
      suppressReorderClickRef.current = true;
      setDragState(null);
      setReorderDraft((current) => {
        const base = current ?? visibleItems;
        const next = applyDisplayIndexMove(base, statusFilter, drag.itemId, drag.targetDisplayIndex);
        return next === base ? current : next;
      });
    };

    const handleCancel = () => {
      detachReorderListeners();
      reorderDragRef.current = null;
      setDragState(null);
    };

    reorderListenersRef.current = { move: handleMove, up: handleUp, cancel: handleCancel };
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleCancel);
  }

  function handleReorderClickCapture(event: React.MouseEvent<HTMLDivElement>) {
    if (!suppressReorderClickRef.current) {
      return;
    }
    suppressReorderClickRef.current = false;
    event.preventDefault();
    event.stopPropagation();
  }

  function getReorderRowStyle(itemId: string): React.CSSProperties | undefined {
    if (!isReordering || !dragState) {
      return undefined;
    }
    const draggedHeight =
      reorderRowElementsRef.current.get(dragState.itemId)?.getBoundingClientRect().height ?? 0;
    if (itemId === dragState.itemId) {
      return { transform: `translateY(${dragState.deltaY}px)` };
    }
    const index = displayedItems.findIndex((item) => item.id === itemId);
    let shift = 0;
    if (index > dragState.sourceDisplayIndex && index <= dragState.targetDisplayIndex) {
      shift = -draggedHeight;
    } else if (index >= dragState.targetDisplayIndex && index < dragState.sourceDisplayIndex) {
      shift = draggedHeight;
    }
    return shift ? { transform: `translateY(${shift}px)` } : undefined;
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

  function handleArchiveSelectedItem() {
    if (!sheetItem) {
      return;
    }

    archiveItemQuietly(sheetItem);
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
            onFilterChange={onStatusFilterChange}
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

          <div className="ds-product-list" ref={listRef}>
            {displayedItems.length ? (
              displayedItems.map((item) =>
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
                ) : isReordering ? (
                  <div
                    key={item.id}
                    ref={(element) => {
                      if (element) {
                        reorderRowElementsRef.current.set(item.id, element);
                      } else {
                        reorderRowElementsRef.current.delete(item.id);
                      }
                    }}
                    className={
                      dragState?.itemId === item.id
                        ? "ds-reorder-row ds-reorder-row--dragging"
                        : "ds-reorder-row"
                    }
                    style={getReorderRowStyle(item.id)}
                    onClickCapture={handleReorderClickCapture}
                    onPointerDown={(event) => handleReorderPointerDown(event, item)}
                  >
                    <ProductRow
                      actions={null}
                      reorderHandle
                      subtitle={getItemSubtitle(item)}
                      title={item.name}
                      onClick={() => setSheetItemId(item.id)}
                    />
                  </div>
                ) : (
                  <div
                    key={item.id}
                    className={
                      swipeState?.itemId === item.id && swipeState.deltaX !== 0
                        ? "ds-swipe-row ds-swipe-row--swiping"
                        : "ds-swipe-row"
                    }
                    onClickCapture={handleSwipeClickCapture}
                    onPointerDown={(event) => handleSwipePointerDown(event, item)}
                  >
                    <div className="ds-swipe-row__underlay">
                      <button
                        type="button"
                        className="ds-swipe-row__action"
                        onClick={() => archiveItemQuietly(item)}
                      >
                        <Archive aria-hidden="true" size={16} />
                        В архив
                      </button>
                    </div>
                    <div
                      className="ds-swipe-row__content"
                      style={
                        swipeState?.itemId === item.id
                          ? { transform: `translateX(${swipeState.deltaX}px)` }
                          : undefined
                      }
                    >
                      <ProductRow
                        actions={<ProductRowMoreButton onClick={() => setSheetItemId(item.id)} />}
                        status={getItemStatus(item)}
                        subtitle={getItemSubtitle(item)}
                        title={item.name}
                        onStatusClick={() => handleStatusClick(item)}
                        onStatusSelect={(nextStatus) => handleStatusSelect(item, nextStatus)}
                      />
                    </div>
                  </div>
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

          {isReordering ? (
            <div className="ds-reorder-bar">
              <Button variant="ghost" onClick={handleCancelReorder}>
                Отмена
              </Button>
              <Button
                variant="solid"
                disabled={isActionPending("items:reorder")}
                onClick={handleFinishReorder}
              >
                {isActionPending("items:reorder") ? "Сохраняем..." : "Готово"}
              </Button>
            </div>
          ) : null}

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
                    disabled={sheetItemIndex <= 0}
                    type="button"
                    onClick={() => sheetItem && handleDraftMove(sheetItem.id, "up")}
                  >
                    <ArrowUp aria-hidden="true" size={18} />
                    Вверх
                  </button>
                  <button
                    className="ds-bottom-sheet__action"
                    disabled={sheetItemIndex === -1 || sheetItemIndex >= displayedItems.length - 1}
                    type="button"
                    onClick={() => sheetItem && handleDraftMove(sheetItem.id, "down")}
                  >
                    <ArrowDown aria-hidden="true" size={18} />
                    Вниз
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
