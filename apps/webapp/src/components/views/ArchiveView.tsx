"use client";

import { ArchiveX, Trash2, Undo2 } from "lucide-react";
import React from "react";

import { formatDate, formatError } from "../../lib/format";
import type { Category, Item } from "../../lib/types";
import { itemStatusToUiStatus } from "../../lib/ui";
import { EmptyState, ProductRow, SectionHeader } from "../common";
import { Button } from "../ui/Button";

export function ArchiveView({
  archivedCategories,
  archivedStandaloneItems,
  onRestoreCategory,
  onDeleteArchivedCategory,
  onRestoreItem,
  onDeleteArchivedItem,
  setError
}: {
  archivedCategories: Category[];
  archivedStandaloneItems: Item[];
  onRestoreCategory: (category: Category) => Promise<void>;
  onDeleteArchivedCategory: (category: Category) => Promise<void>;
  onRestoreItem: (item: Item) => Promise<void>;
  onDeleteArchivedItem: (item: Item) => Promise<void>;
  setError: (message: string | null) => void;
}) {
  function handleRestoreCategory(category: Category) {
    void onRestoreCategory(category).catch((caughtError) => setError(formatError(caughtError)));
  }

  function handleDeleteCategory(category: Category) {
    void onDeleteArchivedCategory(category).catch((caughtError) =>
      setError(formatError(caughtError))
    );
  }

  function handleRestoreItem(item: Item) {
    void onRestoreItem(item).catch((caughtError) => setError(formatError(caughtError)));
  }

  function handleDeleteItem(item: Item) {
    void onDeleteArchivedItem(item).catch((caughtError) => setError(formatError(caughtError)));
  }

  function renderCategoryActions(category: Category) {
    return (
      <div className="ds-row-actions">
        <Button size="compact" variant="ghost" onClick={() => handleRestoreCategory(category)}>
          <Undo2 aria-hidden="true" size={16} />
          Вернуть
        </Button>
        <Button
          className="ds-button--danger"
          size="compact"
          variant="ghost"
          onClick={() => handleDeleteCategory(category)}
        >
          <Trash2 aria-hidden="true" size={16} />
          Удалить
        </Button>
      </div>
    );
  }

  function renderItemActions(item: Item) {
    return (
      <div className="ds-row-actions">
        <Button size="compact" variant="ghost" onClick={() => handleRestoreItem(item)}>
          <Undo2 aria-hidden="true" size={16} />
          Вернуть
        </Button>
        <Button
          className="ds-button--danger"
          size="compact"
          variant="ghost"
          onClick={() => handleDeleteItem(item)}
        >
          <Trash2 aria-hidden="true" size={16} />
          Удалить
        </Button>
      </div>
    );
  }

  function getItemStatus(item: Item): "ok" | "warn" | "bad" | "paused" {
    if (item.status === "PAUSED") {
      return "paused";
    }

    return itemStatusToUiStatus(item.status) ?? "paused";
  }

  return (
    <section className="stack">
      <section className="ds-archive-section" aria-label="Архивные категории">
        <SectionHeader
          title="Категории"
          subtitle="Вернутся вместе с товарами, архивированными в тот же момент"
        />
        {archivedCategories.length ? (
          <div className="ds-product-list">
            {archivedCategories.map((category) => (
              <ProductRow
                key={category.id}
                actions={renderCategoryActions(category)}
                subtitle={`${category.itemCount} поз. · ${formatDate(category.archivedAt)}`}
                title={`${category.icon ? `${category.icon} ` : ""}${category.name}`}
              />
            ))}
          </div>
        ) : (
          <EmptyState description="Архивных категорий нет" icon={ArchiveX} title="Нет категорий" />
        )}
      </section>

      <section className="ds-archive-section" aria-label="Архивные товары">
        <SectionHeader
          title="Товары"
          subtitle="Отдельно архивированные товары из активных категорий"
        />
        {archivedStandaloneItems.length ? (
          <div className="ds-product-list">
            {archivedStandaloneItems.map((item) => (
              <ProductRow
                key={item.id}
                actions={renderItemActions(item)}
                status={getItemStatus(item)}
                subtitle={`${item.category?.name ?? "Без категории"} · ${formatDate(item.archivedAt)}`}
                title={item.name}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            description="Отдельно архивированных товаров нет"
            icon={ArchiveX}
            title="Нет товаров"
          />
        )}
      </section>
    </section>
  );
}
