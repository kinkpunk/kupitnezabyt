"use client";

import { formatDate, formatError } from "../../lib/format";
import type { Category, Item } from "../../lib/types";
import { statusLabels } from "../../lib/ui";

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
  return (
    <section className="stack">
      <div className="section-heading">
        <div>
          <h2>Архив</h2>
          <p>
            {archivedCategories.length + archivedStandaloneItems.length
              ? `${archivedCategories.length} кат. · ${archivedStandaloneItems.length} тов.`
              : "Архив пуст"}
          </p>
        </div>
      </div>

      <section className="archive-section" aria-label="Архивные категории">
        <div className="section-heading">
          <div>
            <h2>Категории</h2>
            <p>Вернутся вместе с товарами, архивированными в тот же момент.</p>
          </div>
        </div>

        <div className="item-list">
          {archivedCategories.length ? (
            archivedCategories.map((category) => (
              <article className="shopping-row" key={category.id}>
                <div>
                  <p>{category.itemCount} поз.</p>
                  <h2>
                    {category.icon ? `${category.icon} ` : ""}
                    {category.name}
                  </h2>
                  <span>{formatDate(category.archivedAt)}</span>
                </div>
                <div className="shopping-actions">
                  <button
                    className="ghost-button"
                    type="button"
                    onClick={() =>
                      void onRestoreCategory(category).catch((caughtError) =>
                        setError(formatError(caughtError))
                      )
                    }
                  >
                    Вернуть
                  </button>
                  <button
                    className="ghost-button danger-button"
                    type="button"
                    onClick={() =>
                      void onDeleteArchivedCategory(category).catch((caughtError) =>
                        setError(formatError(caughtError))
                      )
                    }
                  >
                    Удалить
                  </button>
                </div>
              </article>
            ))
          ) : (
            <p className="empty">Архивных категорий нет.</p>
          )}
        </div>
      </section>

      <section className="archive-section" aria-label="Архивные товары">
        <div className="section-heading">
          <div>
            <h2>Товары</h2>
            <p>Отдельно архивированные товары из активных категорий.</p>
          </div>
        </div>

        <div className="item-list">
          {archivedStandaloneItems.length ? (
            archivedStandaloneItems.map((item) => (
              <article className="shopping-row" key={item.id}>
                <div>
                  <p>{item.category?.name ?? "Без категории"}</p>
                  <h2>{item.name}</h2>
                  <span>
                    {statusLabels[item.status]} · {formatDate(item.archivedAt)}
                  </span>
                </div>
                <div className="shopping-actions">
                  <button
                    className="ghost-button"
                    type="button"
                    onClick={() =>
                      void onRestoreItem(item).catch((caughtError) =>
                        setError(formatError(caughtError))
                      )
                    }
                  >
                    Вернуть
                  </button>
                  <button
                    className="ghost-button danger-button"
                    type="button"
                    onClick={() =>
                      void onDeleteArchivedItem(item).catch((caughtError) =>
                        setError(formatError(caughtError))
                      )
                    }
                  >
                    Удалить
                  </button>
                </div>
              </article>
            ))
          ) : (
            <p className="empty">Отдельно архивированных товаров нет.</p>
          )}
        </div>
      </section>
    </section>
  );
}
