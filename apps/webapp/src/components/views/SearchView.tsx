"use client";

import type { Item } from "../../lib/types";
import { itemStatusBadgeClasses, statusLabels } from "../../lib/ui";

export function SearchView({
  searchQuery,
  hasSearched,
  searchResults,
  onClearSearchSession,
  onSelectCategory,
  onSelectItemsTab
}: {
  searchQuery: string;
  hasSearched: boolean;
  searchResults: Item[];
  onClearSearchSession: () => void;
  onSelectCategory: (categoryId: string) => void;
  onSelectItemsTab: () => void;
}) {
  return (
    <section className="stack">
      <div className="section-heading">
        <div>
          <h2>Поиск</h2>
          <p>{hasSearched ? `Запрос: ${searchQuery}` : "Название, бренд, заметки или категория"}</p>
        </div>
      </div>

      <div className="item-list">
        {searchResults.length ? (
          searchResults.map((item) => (
            <article className="shopping-row" key={item.id}>
              <div>
                <h2>{item.name}</h2>
                <span className="shopping-meta-line">
                  <span className="metadata-text">{item.category?.name ?? "Без категории"}</span>
                  <span className={itemStatusBadgeClasses[item.status]}>{statusLabels[item.status]}</span>
                </span>
              </div>
              <button
                className="ghost-button"
                type="button"
                onClick={() => {
                  onClearSearchSession();
                  onSelectCategory(item.categoryId);
                  onSelectItemsTab();
                }}
              >
                Подробнее
              </button>
            </article>
          ))
        ) : hasSearched ? (
          <p className="empty">Ничего не найдено.</p>
        ) : (
          <p className="empty">Введите запрос, чтобы найти отслеживаемые товары.</p>
        )}
      </div>
    </section>
  );
}
