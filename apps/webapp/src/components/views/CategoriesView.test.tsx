import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import type { Category, Item } from "../../lib/types";
import { CategoriesView } from "./CategoriesView";

const category: Category = {
  id: "cat-1",
  name: "Еда",
  icon: null,
  sortOrder: 0,
  usageCycleDays: 7,
  nextCheckAt: null,
  reminderEnabled: false,
  archivedAt: null,
  itemCount: 2,
  aggregateStatus: "OK"
};

const itemInStock: Item = {
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
  lastCheckedAt: "2024-01-01T00:00:00Z",
  lastBoughtAt: null,
  nextCheckAt: null,
  archivedAt: null
};

const itemLow: Item = {
  ...itemInStock,
  id: "item-2",
  name: "Молоко",
  status: "LOW",
  lastCheckedAt: null
};

const itemNeedBuy: Item = {
  ...itemInStock,
  id: "item-3",
  name: "Хлеб",
  status: "NEED_BUY",
  lastCheckedAt: null
};

function clickFirstButton(name: string | RegExp) {
  const buttons = screen.getAllByRole("button", { name });
  const first = buttons[0];
  expect(first).toBeDefined();
  fireEvent.click(first!);
}

function openFilterPanel() {
  const toggle = screen.getByRole("button", { name: "Фильтры" });
  if (toggle.getAttribute("aria-expanded") !== "true") {
    fireEvent.click(toggle);
  }
}

function clickFilter(name: string | RegExp) {
  openFilterPanel();
  const group = screen.getByRole("group", { name: "Фильтр по статусу" });
  fireEvent.click(within(group).getByRole("button", { name }));
}

function filterChip(name: string | RegExp) {
  openFilterPanel();
  const group = screen.getByRole("group", { name: "Фильтр по статусу" });
  return within(group).getByRole("button", { name });
}

function createProps(overrides: Partial<React.ComponentProps<typeof CategoriesView>> = {}) {
  return {
    categories: [category],
    selectedCategory: category,
    categoryName: "",
    setCategoryName: vi.fn(),
    showCategoryForm: false,
    setShowCategoryForm: vi.fn(),
    itemName: "",
    setItemName: vi.fn(),
    showItemForm: false,
    setShowItemForm: vi.fn(),
    editingItemId: null,
    setEditingItemId: vi.fn(),
    editingItemName: "",
    setEditingItemName: vi.fn(),
    editingItemImportance: "NORMAL" as const,
    setEditingItemImportance: vi.fn(),
    categorySortMode: "manual" as const,
    visibleItems: [itemInStock, itemLow],
    visibleRecommendations: [],
    recommendationSourceItemName: null,
    canWriteActiveWorkspace: true,
    showShareEntryPoint: true,
    searchQuery: "",
    onSearchQueryChange: vi.fn(),
    onSearch: vi.fn().mockResolvedValue(undefined),
    onSelectSettings: vi.fn(),
    onSelectCategory: vi.fn(),
    onCreateCategory: vi.fn().mockResolvedValue(undefined),
    onCreateItem: vi.fn().mockResolvedValue(undefined),
    onSetStatus: vi.fn().mockResolvedValue(undefined),
    onCategorySortModeChange: vi.fn().mockResolvedValue(undefined),
    onMoveItem: vi.fn().mockResolvedValue(undefined),
    onAcceptRecommendation: vi.fn().mockResolvedValue(undefined),
    onDismissRecommendation: vi.fn().mockResolvedValue(undefined),
    onHideSimilarRecommendations: vi.fn().mockResolvedValue(undefined),
    onUpdateItem: vi.fn().mockResolvedValue(undefined),
    onArchiveItem: vi.fn().mockResolvedValue(undefined),
    onArchiveSelectedCategory: vi.fn().mockResolvedValue(undefined),
    onStartCategoryCheck: vi.fn().mockResolvedValue(undefined),
    setError: vi.fn(),
    isActionPending: vi.fn().mockReturnValue(false),
    ...overrides
  };
}

describe("CategoriesView", () => {
  it("renders search field and category tabs without a screen heading", () => {
    render(<CategoriesView {...createProps()} />);
    expect(screen.getByRole("searchbox", { name: "Поиск" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Категории" })).not.toBeInTheDocument();
    expect(screen.queryByText("1 активных")).not.toBeInTheDocument();
  });

  it("renders category tabs", () => {
    render(<CategoriesView {...createProps()} />);
    expect(screen.getByRole("tab", { name: "Еда" })).toHaveAttribute("aria-selected", "true");
  });

  it("renders status filter chips with counts", () => {
    render(<CategoriesView {...createProps()} />);
    expect(filterChip(/Все/)).toHaveTextContent("2");
    expect(filterChip(/Есть/)).toHaveTextContent("1");
    expect(filterChip(/Мало/)).toHaveTextContent("1");
    expect(screen.queryByRole("button", { name: /Нет/ })).not.toBeInTheDocument();
  });

  it("renders need-buy chip with count of items to buy", () => {
    render(<CategoriesView {...createProps({ visibleItems: [itemInStock, itemLow, itemNeedBuy] })} />);
    expect(filterChip(/Нет/)).toHaveTextContent("1");
  });

  it("filters item list by status chip", () => {
    render(<CategoriesView {...createProps()} />);
    clickFilter(/Мало/);
    expect(screen.getByText("Молоко")).toBeInTheDocument();
    expect(screen.queryByText("Кофе")).not.toBeInTheDocument();

    clickFilter(/Все/);
    expect(screen.getByText("Кофе")).toBeInTheDocument();
    expect(screen.getByText("Молоко")).toBeInTheDocument();
  });

  it("shows empty message when filter matches no items", () => {
    const { rerender } = render(
      <CategoriesView {...createProps({ visibleItems: [itemLow] })} />
    );
    clickFilter(/Мало/);
    expect(screen.getByText("Молоко")).toBeInTheDocument();

    rerender(<CategoriesView {...createProps({ visibleItems: [itemInStock] })} />);
    expect(screen.getByText("Нет товаров с таким статусом.")).toBeInTheDocument();
  });

  it("resets status filter when selected category changes", () => {
    const { rerender } = render(<CategoriesView {...createProps()} />);
    clickFilter(/Мало/);
    expect(screen.queryByText("Кофе")).not.toBeInTheDocument();

    rerender(
      <CategoriesView
        {...createProps({ selectedCategory: { ...category, id: "cat-2", name: "Дом" } })}
      />
    );
    expect(screen.getByText("Кофе")).toBeInTheDocument();
    expect(screen.getByText("Молоко")).toBeInTheDocument();
  });

  it("renders product rows for visible items", () => {
    render(<CategoriesView {...createProps()} />);
    expect(screen.getByText("Кофе")).toBeInTheDocument();
    expect(screen.getByText("Молоко")).toBeInTheDocument();
    expect(screen.getByText("Проверено 01 янв.")).toBeInTheDocument();
  });

  it("shows empty state when category has no items", () => {
    render(<CategoriesView {...createProps({ visibleItems: [] })} />);
    expect(screen.getByText("Добавьте первый товар в эту категорию.")).toBeInTheDocument();
  });

  it("shows empty state when no category is selected", () => {
    render(<CategoriesView {...createProps({ selectedCategory: null, visibleItems: [] })} />);
    expect(screen.getByText("Создайте категорию, чтобы добавить первый товар.")).toBeInTheDocument();
  });

  it("opens create category form on plus button click", () => {
    const setShowCategoryForm = vi.fn();
    render(<CategoriesView {...createProps({ setShowCategoryForm })} />);
    fireEvent.click(screen.getByRole("button", { name: "Новая категория" }));
    expect(setShowCategoryForm).toHaveBeenCalledWith(true);
  });

  it("submits create category form", () => {
    const onCreateCategory = vi.fn().mockResolvedValue(undefined);
    render(
      <CategoriesView
        {...createProps({ showCategoryForm: true, categoryName: "Дом", onCreateCategory })}
      />
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Создать" }));
    expect(onCreateCategory).toHaveBeenCalledOnce();
  });

  it("closes create category bottom sheet on close button click", () => {
    const setShowCategoryForm = vi.fn();
    render(
      <CategoriesView {...createProps({ showCategoryForm: true, setShowCategoryForm })} />
    );
    fireEvent.click(screen.getByRole("button", { name: "Закрыть" }));
    expect(setShowCategoryForm).toHaveBeenCalledWith(false);
  });

  it("opens create item sheet via add item row", () => {
    const setShowItemForm = vi.fn();
    render(<CategoriesView {...createProps({ setShowItemForm })} />);
    fireEvent.click(screen.getByRole("button", { name: "Добавить товар" }));
    expect(setShowItemForm).toHaveBeenCalledWith(true);
  });

  it("hides add item row while reordering", () => {
    render(<CategoriesView {...createProps()} />);
    expect(screen.getByRole("button", { name: "Добавить товар" })).toBeInTheDocument();

    clickFirstButton("Ещё");
    fireEvent.click(screen.getByRole("button", { name: "Изменить порядок" }));
    expect(screen.queryByRole("button", { name: "Добавить товар" })).not.toBeInTheDocument();
  });

  it("submits create item form inside bottom sheet", () => {
    const onCreateItem = vi.fn().mockResolvedValue(undefined);
    render(
      <CategoriesView
        {...createProps({ showItemForm: true, itemName: "Хлеб", onCreateItem })}
      />
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Добавить" }));
    expect(onCreateItem).toHaveBeenCalledOnce();
  });

  it("opens item actions sheet and triggers edit", () => {
    const setEditingItemId = vi.fn();
    const setEditingItemName = vi.fn();
    const setEditingItemImportance = vi.fn();
    render(
      <CategoriesView
        {...createProps({
          setEditingItemId,
          setEditingItemName,
          setEditingItemImportance
        })}
      />
    );
    clickFirstButton("Ещё");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Редактировать" }));
    expect(setEditingItemId).toHaveBeenCalledWith(itemInStock.id);
    expect(setEditingItemName).toHaveBeenCalledWith(itemInStock.name);
    expect(setEditingItemImportance).toHaveBeenCalledWith(itemInStock.importance);
  });

  it("archives item from actions sheet", () => {
    const onArchiveItem = vi.fn().mockResolvedValue(undefined);
    render(<CategoriesView {...createProps({ onArchiveItem })} />);
    clickFirstButton("Ещё");
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "В архив" }));
    expect(onArchiveItem).toHaveBeenCalledWith(itemInStock);
  });

  it("allows archiving an empty category while check stays disabled", () => {
    const onArchiveSelectedCategory = vi.fn().mockResolvedValue(undefined);
    const emptyCategory = { ...category, itemCount: 0, aggregateStatus: "OK" as const };
    render(
      <CategoriesView
        {...createProps({
          categories: [emptyCategory],
          selectedCategory: emptyCategory,
          visibleItems: [],
          onArchiveSelectedCategory
        })}
      />
    );
    expect(screen.getByRole("button", { name: "Проверить" })).toBeDisabled();
    const archiveButton = screen.getByRole("button", { name: "В архив" });
    expect(archiveButton).toBeEnabled();
    fireEvent.click(archiveButton);
    expect(onArchiveSelectedCategory).toHaveBeenCalledOnce();
  });

  it("enters reorder mode from actions sheet", async () => {
    const onCategorySortModeChange = vi.fn().mockResolvedValue(undefined);
    render(
      <CategoriesView
        {...createProps({
          categorySortMode: "status",
          onCategorySortModeChange
        })}
      />
    );
    clickFirstButton("Ещё");
    fireEvent.click(screen.getByRole("button", { name: "Изменить порядок" }));
    await waitFor(() => {
      expect(onCategorySortModeChange).toHaveBeenCalledWith("manual");
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.querySelector(".ds-product-row__reorder")).toBeInTheDocument();
  });

  it("moves item up and exits reorder mode via done button", async () => {
    const onMoveItem = vi.fn().mockResolvedValue(undefined);
    const onCategorySortModeChange = vi.fn().mockResolvedValue(undefined);
    render(
      <CategoriesView
        {...createProps({
          onMoveItem,
          onCategorySortModeChange
        })}
      />
    );
    clickFirstButton("Ещё");
    fireEvent.click(screen.getByRole("button", { name: "Изменить порядок" }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    const rows = screen.getAllByRole("button", { name: /^(Кофе|Молоко)/ });
    fireEvent.click(rows[1]!);
    fireEvent.click(screen.getByRole("button", { name: "Вверх" }));
    expect(onMoveItem).toHaveBeenCalledWith(itemLow, "up");

    fireEvent.click(screen.getByRole("button", { name: "Готово" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.querySelector(".ds-product-row__reorder")).not.toBeInTheDocument();
  });

  it("offers status sort option when manual order is active", async () => {
    const onCategorySortModeChange = vi.fn().mockResolvedValue(undefined);
    render(
      <CategoriesView
        {...createProps({
          categorySortMode: "manual",
          onCategorySortModeChange
        })}
      />
    );
    clickFirstButton("Ещё");
    fireEvent.click(screen.getByRole("button", { name: "Сортировать по статусу" }));
    await waitFor(() => {
      expect(onCategorySortModeChange).toHaveBeenCalledWith("status");
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("does not show status sort option when already sorting by status", () => {
    render(<CategoriesView {...createProps({ categorySortMode: "status" })} />);
    clickFirstButton("Ещё");
    expect(
      screen.queryByRole("button", { name: "Сортировать по статусу" })
    ).not.toBeInTheDocument();
  });

  it("cycles status when status chip is clicked", () => {
    const onSetStatus = vi.fn().mockResolvedValue(undefined);
    render(<CategoriesView {...createProps({ onSetStatus })} />);
    clickFirstButton(/Статус:/);
    expect(onSetStatus).toHaveBeenCalledWith(itemInStock, "LOW");
  });

  it("submits search form", () => {
    const onSearch = vi.fn().mockResolvedValue(undefined);
    render(<CategoriesView {...createProps({ searchQuery: "кофе", onSearch })} />);
    fireEvent.submit(screen.getByRole("search"));
    expect(onSearch).toHaveBeenCalledOnce();
  });

  it("calls onSelectCategory when tab is clicked", () => {
    const onSelectCategory = vi.fn();
    render(<CategoriesView {...createProps({ onSelectCategory })} />);
    fireEvent.click(screen.getByRole("tab", { name: "Еда" }));
    expect(onSelectCategory).toHaveBeenCalledWith(category.id);
  });
});
