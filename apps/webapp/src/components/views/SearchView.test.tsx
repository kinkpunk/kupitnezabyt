import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import type { Category, Item } from "../../lib/types";
import { SearchView } from "./SearchView";

const category: Category = {
  id: "cat-1",
  name: "Еда",
  icon: null,
  sortOrder: 0,
  usageCycleDays: 7,
  nextCheckAt: null,
  reminderEnabled: false,
  archivedAt: null,
  itemCount: 1,
  aggregateStatus: "OK"
};

const item: Item = {
  id: "item-1",
  userId: "u1",
  categoryId: "cat-1",
  name: "Кофе",
  brand: null,
  notes: null,
  status: "IN_STOCK",
  importance: "NORMAL",
  usageCycleDays: null,
  reminderEnabled: false,
  sortOrder: 0,
  lastCheckedAt: null,
  lastBoughtAt: null,
  nextCheckAt: null,
  archivedAt: null,
  category
};

function createProps(overrides: Partial<React.ComponentProps<typeof SearchView>> = {}) {
  return {
    searchQuery: "",
    hasSearched: false,
    searchResults: [] as Item[],
    onSearchQueryChange: vi.fn(),
    onSearch: vi.fn().mockResolvedValue(undefined),
    onClearSearchSession: vi.fn(),
    onSelectCategory: vi.fn(),
    onSelectItemsTab: vi.fn(),
    ...overrides
  };
}

describe("SearchView", () => {
  it("renders search field and initial empty state", () => {
    render(<SearchView {...createProps()} />);
    expect(screen.getByRole("searchbox", { name: "Поиск" })).toBeInTheDocument();
    expect(screen.getByText("Поиск по товарам")).toBeInTheDocument();
  });

  it("submits search form", () => {
    const onSearch = vi.fn().mockResolvedValue(undefined);
    render(<SearchView {...createProps({ searchQuery: "кофе", onSearch })} />);
    fireEvent.submit(screen.getByRole("search"));
    expect(onSearch).toHaveBeenCalledOnce();
  });

  it("renders search results", () => {
    render(<SearchView {...createProps({ hasSearched: true, searchResults: [item] })} />);
    expect(screen.getByText("Кофе")).toBeInTheDocument();
    expect(screen.getByText("Еда")).toBeInTheDocument();
  });

  it("renders no results state", () => {
    render(<SearchView {...createProps({ hasSearched: true, searchResults: [] })} />);
    expect(screen.getByText("Ничего не найдено")).toBeInTheDocument();
  });

  it("navigates to category when result is clicked", () => {
    const onClearSearchSession = vi.fn();
    const onSelectCategory = vi.fn();
    const onSelectItemsTab = vi.fn();
    render(
      <SearchView
        {...createProps({
          hasSearched: true,
          searchResults: [item],
          onClearSearchSession,
          onSelectCategory,
          onSelectItemsTab
        })}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Кофе Еда Есть" }));
    expect(onClearSearchSession).toHaveBeenCalledOnce();
    expect(onSelectCategory).toHaveBeenCalledWith(item.categoryId);
    expect(onSelectItemsTab).toHaveBeenCalledOnce();
  });
});
