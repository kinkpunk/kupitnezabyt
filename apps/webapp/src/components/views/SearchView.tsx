"use client";

import { Search } from "lucide-react";
import React from "react";

import type { Item } from "../../lib/types";
import { itemStatusToUiStatus } from "../../lib/ui";
import { EmptyState, ProductRow, SearchField, SectionHeader } from "../common";

export function SearchView({
  searchQuery,
  hasSearched,
  searchResults,
  onSearchQueryChange,
  onSearch,
  onClearSearchSession,
  onSelectCategory,
  onSelectItemsTab
}: {
  searchQuery: string;
  hasSearched: boolean;
  searchResults: Item[];
  onSearchQueryChange: (value: string) => void;
  onSearch: () => Promise<void>;
  onClearSearchSession: () => void;
  onSelectCategory: (categoryId: string) => void;
  onSelectItemsTab: () => void;
}) {
  function handleSearchSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void onSearch();
  }

  function handleOpenItem(item: Item) {
    onClearSearchSession();
    onSelectCategory(item.categoryId);
    onSelectItemsTab();
  }

  function getItemStatus(item: Item): "ok" | "warn" | "bad" | "paused" {
    if (item.status === "PAUSED") {
      return "paused";
    }

    return itemStatusToUiStatus(item.status) ?? "paused";
  }

  return (
    <section className="stack">
      <SectionHeader
        title="Поиск"
        subtitle={
          hasSearched ? `Запрос: ${searchQuery}` : "Название, бренд, заметки или категория"
        }
      />

      <form className="ds-categories-view__search" role="search" onSubmit={handleSearchSubmit}>
        <SearchField value={searchQuery} onChange={onSearchQueryChange} />
      </form>

      <div className="item-list">
        {searchResults.length ? (
          searchResults.map((item) => (
            <ProductRow
              key={item.id}
              status={getItemStatus(item)}
              subtitle={item.category?.name ?? "Без категории"}
              title={item.name}
              onClick={() => handleOpenItem(item)}
            />
          ))
        ) : hasSearched ? (
          <EmptyState
            description="Попробуйте изменить запрос"
            icon={Search}
            title="Ничего не найдено"
          />
        ) : (
          <EmptyState
            description="Введите запрос, чтобы найти отслеживаемые товары"
            icon={Search}
            title="Поиск по товарам"
          />
        )}
      </div>
    </section>
  );
}
