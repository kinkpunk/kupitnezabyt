import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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

function clickFirstButton(name: string | RegExp) {
  const buttons = screen.getAllByRole("button", { name });
  const first = buttons[0];
  expect(first).toBeDefined();
  fireEvent.click(first!);
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
  it("renders search field and category heading", () => {
    render(<CategoriesView {...createProps()} />);
    expect(screen.getByRole("searchbox", { name: "Поиск" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Категории" })).toBeInTheDocument();
    expect(screen.getByText("1 активных")).toBeInTheDocument();
  });

  it("renders category tabs", () => {
    render(<CategoriesView {...createProps()} />);
    expect(screen.getByRole("tab", { name: "Еда" })).toHaveAttribute("aria-selected", "true");
  });

  it("renders panel header with progress", () => {
    render(<CategoriesView {...createProps()} />);
    expect(screen.getByText("Купить · 1 из 2")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "1");
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuemax", "2");
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

  it("opens create item sheet via FAB", () => {
    const setShowItemForm = vi.fn();
    render(<CategoriesView {...createProps({ setShowItemForm })} />);
    fireEvent.click(screen.getByRole("button", { name: "Новый товар" }));
    expect(setShowItemForm).toHaveBeenCalledWith(true);
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
    fireEvent.click(screen.getByRole("button", { name: "В архив" }));
    expect(onArchiveItem).toHaveBeenCalledWith(itemInStock);
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
