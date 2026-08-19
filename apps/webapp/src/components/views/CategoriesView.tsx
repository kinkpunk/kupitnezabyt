"use client";

import type { ItemImportance, ItemStatus } from "@kupitnezabyt/shared";
import {
  Archive,
  ArrowDown,
  ArrowUp,
  GripVertical,
  Pencil,
  Plus,
  Signal,
  TriangleAlert,
  Users,
  X
} from "lucide-react";
import type { RefObject } from "react";

import type { CategorySortMode } from "../../lib/api";
import { formatError } from "../../lib/format";
import type { Category, Item, RecommendationSuggestion } from "../../lib/types";
import {
  categoryTriggerItemStatus,
  importanceBadgeClasses,
  importanceLabels,
  importanceOptions,
  statusLabels,
  statusOptions
} from "../../lib/ui";

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
  categoryRowClassName,
  categoryRowRef,
  showShareEntryPoint,
  onSelectSettings,
  onClearSearchSession,
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
  isActionPending,
  formatCategoryTabMeta
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
  categoryRowClassName: string;
  categoryRowRef: RefObject<HTMLDivElement | null>;
  showShareEntryPoint: boolean;
  onSelectSettings: () => void;
  onClearSearchSession: () => void;
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
  formatCategoryTabMeta: (category: Category) => string;
}) {
  return (
    <section className="stack">
      <div className="section-heading">
        <div>
          <h2>Категории</h2>
          <p>{categories.length ? `${categories.length} активных` : "Пока нет"}</p>
        </div>
        <div className="icon-actions">
          {showShareEntryPoint ? (
            <button
              aria-label="Поделиться списком"
              className="ghost-button icon-button"
              title="Поделиться списком"
              type="button"
              onClick={onSelectSettings}
            >
              <Users aria-hidden="true" size={18} />
            </button>
          ) : null}
          <button
            aria-label={showCategoryForm ? "Скрыть форму категории" : "Новая категория"}
            className="ghost-button icon-button"
            title={showCategoryForm ? "Скрыть" : "Новая категория"}
            type="button"
            onClick={() => setShowCategoryForm((current) => !current)}
          >
            {showCategoryForm ? (
              <X aria-hidden="true" size={18} />
            ) : (
              <Plus aria-hidden="true" size={18} />
            )}
          </button>
        </div>
      </div>

      {showCategoryForm ? (
        <form
          className="inline-form category-create-form"
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
          <button
            type="submit"
            disabled={isActionPending("category:create") || !categoryName.trim()}
          >
            {isActionPending("category:create") ? "Создаем..." : "Создать"}
          </button>
        </form>
      ) : null}

      <div
        aria-label="Категории"
        className={categoryRowClassName}
        ref={categoryRowRef}
        role="tablist"
      >
        {categories.map((category) => (
          <button
            aria-controls="category-panel"
            aria-label={`${category.name}: ${formatCategoryTabMeta(category)}`}
            aria-selected={selectedCategory?.id === category.id}
            className={selectedCategory?.id === category.id ? "category active" : "category"}
            key={category.id}
            role="tab"
            type="button"
            onClick={() => {
              onClearSearchSession();
              onSelectCategory(category.id);
              setShowCategoryForm(false);
            }}
          >
            <span>
              {category.icon ? `${category.icon} ` : ""}
              {category.name}
            </span>
            {categoryTriggerItemStatus[category.aggregateStatus] ? (
              <TriangleAlert
                aria-hidden="true"
                className="category-warning"
                data-status={categoryTriggerItemStatus[category.aggregateStatus]}
                size={14}
              />
            ) : null}
          </button>
        ))}
      </div>

      {selectedCategory ? (
        <section
          aria-label={selectedCategory.name}
          className="category-panel"
          id="category-panel"
          role="tabpanel"
        >
          <div className="category-panel-actions">
            <p className="category-panel-meta">{formatCategoryTabMeta(selectedCategory)}</p>
            <div className="category-panel-buttons">
              <button
                className="ghost-button"
                disabled={selectedCategory.itemCount === 0}
                type="button"
                onClick={() =>
                  void onStartCategoryCheck().catch((caughtError) =>
                    setError(formatError(caughtError))
                  )
                }
              >
                Проверить
              </button>
              <button
                className="ghost-button danger-button"
                type="button"
                onClick={() =>
                  void onArchiveSelectedCategory().catch((caughtError) =>
                    setError(formatError(caughtError))
                  )
                }
              >
                Архив
              </button>
            </div>
          </div>

          <div className="category-toolbar">
            <button
              aria-label={showItemForm ? "Скрыть форму товара" : "Новый товар"}
              className="ghost-button icon-button"
              title={showItemForm ? "Скрыть" : "Новый товар"}
              type="button"
              onClick={() => setShowItemForm((current) => !current)}
            >
              {showItemForm ? (
                <X aria-hidden="true" size={18} />
              ) : (
                <Plus aria-hidden="true" size={18} />
              )}
            </button>
            {selectedCategory.itemCount > 0 ? (
              <div
                className="category-sort-toggle"
                role="group"
                aria-label="Сортировка товаров"
              >
                <button
                  type="button"
                  aria-label="Мой порядок"
                  className={categorySortMode === "manual" ? "active" : undefined}
                  title="Мой порядок"
                  onClick={() =>
                    void onCategorySortModeChange("manual").catch((caughtError) =>
                      setError(formatError(caughtError))
                    )
                  }
                >
                  <GripVertical aria-hidden="true" size={18} />
                  <span className="sort-label">Мой порядок</span>
                </button>
                <button
                  type="button"
                  aria-label="По статусу"
                  className={categorySortMode === "status" ? "active" : undefined}
                  title="По статусу"
                  onClick={() =>
                    void onCategorySortModeChange("status").catch((caughtError) =>
                      setError(formatError(caughtError))
                    )
                  }
                >
                  <Signal aria-hidden="true" size={18} />
                  <span className="sort-label">По статусу</span>
                </button>
              </div>
            ) : null}
          </div>

          {showItemForm ? (
            <form
              className="inline-form item-create-form"
              onSubmit={(event) => {
                event.preventDefault();
                void onCreateItem().catch((caughtError) => setError(formatError(caughtError)));
              }}
            >
              <input
                aria-label="Название товара"
                placeholder="Новый товар"
                value={itemName}
                disabled={isActionPending("item:create")}
                onChange={(event) => setItemName(event.target.value)}
              />
              <button type="submit" disabled={isActionPending("item:create") || !itemName.trim()}>
                {isActionPending("item:create") ? "Добавляем..." : "Добавить"}
              </button>
            </form>
          ) : null}

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
                    <div className="shopping-actions">
                      <button
                        className="ghost-button"
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
                        className="ghost-button"
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

          <div className="item-list">
            {visibleItems.length ? (
              visibleItems.map((item, index) => (
                <article className="item-card" key={item.id}>
                  {editingItemId === item.id ? (
                    <form
                      className="inline-form"
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
                      <button type="submit">Сохранить</button>
                    </form>
                  ) : (
                    <div className="item-card-header">
                      <div>
                        <h2>{item.name}</h2>
                        {item.importance !== "NORMAL" ? (
                          <span className={importanceBadgeClasses[item.importance]}>
                            {importanceLabels[item.importance]}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  )}
                  <div className="item-card-controls">
                    <select
                      aria-label={`Статус товара ${item.name}`}
                      className="status-select"
                      data-status={item.status}
                      disabled={isActionPending(`item:status:${item.id}`)}
                      value={item.status}
                      onChange={(event) =>
                        void onSetStatus(item, event.target.value as ItemStatus).catch(
                          (caughtError) => setError(formatError(caughtError))
                        )
                      }
                    >
                      {statusOptions.map((status) => (
                        <option key={status} value={status}>
                          {statusLabels[status]}
                        </option>
                      ))}
                      {item.status === "PAUSED" ? (
                        <option value="PAUSED">{statusLabels.PAUSED}</option>
                      ) : null}
                    </select>
                    {editingItemId !== item.id ? (
                      <div className="icon-actions">
                        {canWriteActiveWorkspace &&
                        categorySortMode === "manual" &&
                        visibleItems.length > 1 ? (
                          <>
                            <button
                              aria-label={`Переместить товар ${item.name} выше`}
                              className="ghost-button icon-button reorder-button"
                              title="Переместить выше"
                              type="button"
                              disabled={index === 0 || isActionPending(`item:reorder:${item.id}`)}
                              onClick={() =>
                                void onMoveItem(item, "up").catch((caughtError) =>
                                  setError(formatError(caughtError))
                                )
                              }
                            >
                              <ArrowUp aria-hidden="true" size={18} />
                            </button>
                            <button
                              aria-label={`Переместить товар ${item.name} ниже`}
                              className="ghost-button icon-button reorder-button"
                              title="Переместить ниже"
                              type="button"
                              disabled={
                                index === visibleItems.length - 1 ||
                                isActionPending(`item:reorder:${item.id}`)
                              }
                              onClick={() =>
                                void onMoveItem(item, "down").catch((caughtError) =>
                                  setError(formatError(caughtError))
                                )
                              }
                            >
                              <ArrowDown aria-hidden="true" size={18} />
                            </button>
                          </>
                        ) : null}
                        <button
                          aria-label={`Изменить товар ${item.name}`}
                          className="ghost-button icon-button"
                          title="Изменить"
                          type="button"
                          onClick={() => {
                            setEditingItemId(item.id);
                            setEditingItemName(item.name);
                            setEditingItemImportance(item.importance);
                          }}
                        >
                          <Pencil aria-hidden="true" size={18} />
                        </button>
                        <button
                          aria-label={`Архивировать товар ${item.name}`}
                          className="ghost-button danger-button icon-button"
                          title="Архивировать"
                          type="button"
                          onClick={() =>
                            void onArchiveItem(item).catch((caughtError) =>
                              setError(formatError(caughtError))
                            )
                          }
                        >
                          <Archive aria-hidden="true" size={18} />
                        </button>
                      </div>
                    ) : null}
                  </div>
                </article>
              ))
            ) : (
              <p className="empty">Добавьте первый товар в эту категорию.</p>
            )}
          </div>
        </section>
      ) : (
        <p className="empty">Создайте категорию, чтобы добавить первый товар.</p>
      )}
    </section>
  );
}
