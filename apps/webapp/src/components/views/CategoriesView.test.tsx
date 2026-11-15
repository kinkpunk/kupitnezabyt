import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import type { Category, Item, RecommendationSuggestion } from "../../lib/types";
import type { CategoryStatusFilter } from "../../lib/ui";
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

const recommendation: RecommendationSuggestion = {
  id: "rec-1",
  ruleId: "rule-1",
  suggestedItem: "Сахар",
  categoryHint: "Еда"
};

function clickFirstButton(name: string | RegExp) {
  const buttons = screen.getAllByRole("button", { name });
  const first = buttons[0];
  expect(first).toBeDefined();
  fireEvent.click(first!);
}

function clickItemActionsButton() {
  const list = document.querySelector(".ds-product-list");
  expect(list).not.toBeNull();
  const button = within(list as HTMLElement).getAllByRole("button", { name: "Ещё" })[0];
  expect(button).toBeDefined();
  fireEvent.click(button!);
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

// jsdom не реализует PointerEvent с координатами: dispatch через MouseEvent,
// pointerId проставляется отдельно (обработчики сверяют его с pointerdown).
function firePointer(
  target: Element | Window,
  type: string,
  init: { pointerId: number; clientX: number; clientY: number }
) {
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: init.clientX,
    clientY: init.clientY
  });
  Object.defineProperty(event, "pointerId", { value: init.pointerId });
  fireEvent(target, event);
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
    categorySortMode: "manual" as const,
    visibleItems: [itemInStock, itemLow],
    visibleRecommendations: [],
    recommendationSourceItemName: null,
    canWriteActiveWorkspace: true,
    searchQuery: "",
    onSearchQueryChange: vi.fn(),
    onSearch: vi.fn().mockResolvedValue(undefined),
    onSelectCategory: vi.fn(),
    statusFilter: "all" as CategoryStatusFilter,
    onStatusFilterChange: vi.fn(),
    onCreateCategory: vi.fn().mockResolvedValue(undefined),
    onCreateItem: vi.fn().mockResolvedValue(undefined),
    onSetStatus: vi.fn().mockResolvedValue(undefined),
    onCategorySortModeChange: vi.fn().mockResolvedValue(undefined),
    onReorderItems: vi.fn().mockResolvedValue(undefined),
    onAcceptRecommendation: vi.fn().mockResolvedValue(undefined),
    onDismissRecommendation: vi.fn().mockResolvedValue(undefined),
    onHideSimilarRecommendations: vi.fn().mockResolvedValue(undefined),
    onUpdateItem: vi.fn().mockResolvedValue(undefined),
    onArchiveItem: vi.fn().mockResolvedValue(undefined),
    onArchiveSelectedCategory: vi.fn().mockResolvedValue(undefined),
    onStartCategoryCheck: vi.fn().mockResolvedValue(undefined),
    onSaveReminderSetting: vi.fn().mockResolvedValue(undefined),
    savingReminderKeys: [] as string[],
    setError: vi.fn(),
    isActionPending: vi.fn().mockReturnValue(false),
    ...overrides
  };
}

function StatefulCategoriesView(props: React.ComponentProps<typeof CategoriesView>) {
  const [statusFilter, setStatusFilter] = React.useState<CategoryStatusFilter>("all");
  return (
    <CategoriesView
      {...props}
      statusFilter={statusFilter}
      onStatusFilterChange={setStatusFilter}
    />
  );
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
    openFilterPanel();
    const filterGroup = screen.getByRole("group", { name: "Фильтр по статусу" });
    expect(within(filterGroup).queryByRole("button", { name: /Нет/ })).not.toBeInTheDocument();
  });

  it("renders need-buy chip with count of items to buy", () => {
    render(<CategoriesView {...createProps({ visibleItems: [itemInStock, itemLow, itemNeedBuy] })} />);
    expect(filterChip(/Нет/)).toHaveTextContent("1");
  });

  it("filters item list by status chip", () => {
    render(<StatefulCategoriesView {...createProps()} />);
    clickFilter(/Мало/);
    expect(screen.getByText("Молоко")).toBeInTheDocument();
    expect(screen.queryByText("Кофе")).not.toBeInTheDocument();

    clickFilter(/Все/);
    expect(screen.getByText("Кофе")).toBeInTheDocument();
    expect(screen.getByText("Молоко")).toBeInTheDocument();
  });

  it("shows empty message when filter matches no items", () => {
    const { rerender } = render(
      <StatefulCategoriesView {...createProps({ visibleItems: [itemLow] })} />
    );
    clickFilter(/Мало/);
    expect(screen.getByText("Молоко")).toBeInTheDocument();

    rerender(
      <StatefulCategoriesView {...createProps({ visibleItems: [itemInStock] })} />
    );
    expect(screen.getByText("Нет товаров с таким статусом.")).toBeInTheDocument();
  });

  it("reports filter changes via onStatusFilterChange", () => {
    const onStatusFilterChange = vi.fn();
    render(<CategoriesView {...createProps({ onStatusFilterChange })} />);
    clickFilter(/Мало/);
    expect(onStatusFilterChange).toHaveBeenCalledWith("low");
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

  it("opens create item sheet from the empty state CTA", () => {
    const setShowItemForm = vi.fn();
    render(<CategoriesView {...createProps({ visibleItems: [], setShowItemForm })} />);
    fireEvent.click(screen.getByRole("button", { name: "Добавить товар" }));
    expect(setShowItemForm).toHaveBeenCalledWith(true);
  });

  it("shows empty state when no category is selected", () => {
    render(<CategoriesView {...createProps({ selectedCategory: null, visibleItems: [] })} />);
    expect(screen.getByText("Создайте категорию, чтобы добавить первый товар.")).toBeInTheDocument();
  });

  it("opens create category sheet from the empty state CTA", () => {
    const setShowCategoryForm = vi.fn();
    render(
      <CategoriesView {...createProps({ selectedCategory: null, visibleItems: [], setShowCategoryForm })} />
    );
    fireEvent.click(screen.getByRole("button", { name: "Создать категорию" }));
    expect(setShowCategoryForm).toHaveBeenCalledWith(true);
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

  it("passes an empty reminder when creating a category", () => {
    const onCreateCategory = vi.fn().mockResolvedValue(undefined);
    render(
      <CategoriesView
        {...createProps({ showCategoryForm: true, categoryName: "Дом", onCreateCategory })}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Создать" }));
    expect(onCreateCategory).toHaveBeenCalledWith({
      usageCycleDays: null,
      reminderEnabled: false
    });
  });

  it("closes create category bottom sheet on close button click", () => {
    const setShowCategoryForm = vi.fn();
    render(
      <CategoriesView {...createProps({ showCategoryForm: true, setShowCategoryForm })} />
    );
    fireEvent.click(screen.getByRole("button", { name: "Закрыть" }));
    expect(setShowCategoryForm).toHaveBeenCalledWith(false);
  });

  it("opens create item sheet from the panel header", () => {
    const setShowItemForm = vi.fn();
    render(<CategoriesView {...createProps({ setShowItemForm })} />);
    fireEvent.click(screen.getByRole("button", { name: "Добавить товар" }));
    expect(setShowItemForm).toHaveBeenCalledWith(true);
    expect(document.querySelector(".ds-add-item-row")).not.toBeInTheDocument();
  });

  it("hides the panel add button in an empty category", () => {
    render(<CategoriesView {...createProps({ visibleItems: [] })} />);
    expect(document.querySelector(".ds-panel-header__add")).not.toBeInTheDocument();
    expect(screen.getByText("Добавьте первый товар в эту категорию.")).toBeInTheDocument();
  });

  it("hides panel add button while reordering", () => {
    render(<CategoriesView {...createProps()} />);
    expect(screen.getByRole("button", { name: "Добавить товар" })).toBeInTheDocument();

    clickItemActionsButton();
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

  it("passes reminder settings when creating an item with the switch on", () => {
    const onCreateItem = vi.fn().mockResolvedValue(undefined);
    render(
      <CategoriesView
        {...createProps({ showItemForm: true, itemName: "Хлеб", onCreateItem })}
      />
    );
    fireEvent.click(screen.getByRole("switch"));
    const daysInput = screen.getByLabelText("Количество дней");
    expect(daysInput).toBeEnabled();
    expect(daysInput).toHaveValue(30);
    fireEvent.click(screen.getByRole("button", { name: "Добавить" }));
    expect(onCreateItem).toHaveBeenCalledWith({ usageCycleDays: 30, reminderEnabled: true });
  });

  it("opens item actions sheet and triggers edit", () => {
    const setEditingItemId = vi.fn();
    const setEditingItemName = vi.fn();
    render(
      <CategoriesView
        {...createProps({
          setEditingItemId,
          setEditingItemName
        })}
      />
    );
    clickItemActionsButton();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Редактировать" }));
    expect(setEditingItemId).toHaveBeenCalledWith(itemInStock.id);
    expect(setEditingItemName).toHaveBeenCalledWith(itemInStock.name);
  });

  it("archives item from actions sheet", () => {
    const onArchiveItem = vi.fn().mockResolvedValue(undefined);
    render(<CategoriesView {...createProps({ onArchiveItem })} />);
    clickItemActionsButton();
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "В архив" }));
    expect(onArchiveItem).toHaveBeenCalledWith(itemInStock);
  });

  it("opens item reminder sheet and saves the setting", async () => {
    const onSaveReminderSetting = vi.fn().mockResolvedValue(undefined);
    render(<CategoriesView {...createProps({ onSaveReminderSetting })} />);
    clickItemActionsButton();
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Напоминание о проверке" })
    );

    const switchButton = screen.getByRole("switch");
    expect(switchButton).toHaveAttribute("aria-checked", "false");
    const daysInput = screen.getByLabelText("Количество дней");
    expect(daysInput).toBeDisabled();

    fireEvent.click(switchButton);
    expect(daysInput).toBeEnabled();
    fireEvent.change(daysInput, { target: { value: "30" } });
    fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    await waitFor(() =>
      expect(onSaveReminderSetting).toHaveBeenCalledWith("ITEM", itemInStock.id, {
        usageCycleDays: 30,
        reminderEnabled: true
      })
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens category reminder sheet from the panel menu", () => {
    render(<CategoriesView {...createProps()} />);
    const panel = document.querySelector(".ds-panel-header") as HTMLElement;
    fireEvent.click(within(panel).getByRole("button", { name: "Ещё" }));
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Напоминание о проверке" })
    );
    expect(screen.getByRole("dialog")).toHaveAttribute("aria-label", "Еда");
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "false");
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
    const moreButton = screen.getByRole("button", { name: "Ещё" });
    expect(moreButton).toBeEnabled();
    fireEvent.click(moreButton);
    const archiveButton = within(screen.getByRole("dialog")).getByRole("button", {
      name: "В архив"
    });
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
    clickItemActionsButton();
    fireEvent.click(screen.getByRole("button", { name: "Изменить порядок" }));
    await waitFor(() => {
      expect(onCategorySortModeChange).toHaveBeenCalledWith("manual");
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.querySelector(".ds-product-row__reorder")).toBeInTheDocument();
  });

  it("moves item via sheet buttons and commits the full order on done", async () => {
    const onReorderItems = vi.fn().mockResolvedValue(undefined);
    const onCategorySortModeChange = vi.fn().mockResolvedValue(undefined);
    render(
      <CategoriesView
        {...createProps({
          onReorderItems,
          onCategorySortModeChange
        })}
      />
    );
    clickItemActionsButton();
    fireEvent.click(screen.getByRole("button", { name: "Изменить порядок" }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    const rows = screen.getAllByRole("button", { name: /^(Кофе|Молоко)/ });
    fireEvent.click(rows[1]!);
    fireEvent.click(screen.getByRole("button", { name: "Вверх" }));
    expect(onReorderItems).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Готово" }));
    expect(onReorderItems).toHaveBeenCalledWith(["item-2", "item-1"]);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.querySelector(".ds-product-row__reorder")).not.toBeInTheDocument();
  });

  it("does not call the API when reorder mode ends without changes", async () => {
    const onReorderItems = vi.fn().mockResolvedValue(undefined);
    render(<CategoriesView {...createProps({ onReorderItems, categorySortMode: "manual" })} />);
    clickItemActionsButton();
    fireEvent.click(screen.getByRole("button", { name: "Изменить порядок" }));
    await waitFor(() => {
      expect(document.querySelector(".ds-product-row__reorder")).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByRole("button", { name: /^(Кофе|Молоко)/ })[0]!);
    fireEvent.click(screen.getByRole("button", { name: "Готово" }));
    expect(onReorderItems).not.toHaveBeenCalled();
  });

  it("reorders by dragging a row and commits on done", async () => {
    const onReorderItems = vi.fn().mockResolvedValue(undefined);
    render(<CategoriesView {...createProps({ onReorderItems, categorySortMode: "manual" })} />);
    clickItemActionsButton();
    fireEvent.click(screen.getByRole("button", { name: "Изменить порядок" }));
    await waitFor(() => {
      expect(document.querySelectorAll(".ds-reorder-row")).toHaveLength(2);
    });

    const wrappers = document.querySelectorAll(".ds-reorder-row");
    wrappers.forEach((row, index) => {
      vi.spyOn(row, "getBoundingClientRect").mockReturnValue({
        top: index * 72,
        bottom: (index + 1) * 72,
        height: 72,
        left: 0,
        right: 300,
        width: 300,
        x: 0,
        y: index * 72,
        toJSON: () => ({})
      } as DOMRect);
    });

    firePointer(wrappers[0]!, "pointerdown", { pointerId: 7, clientX: 20, clientY: 20 });
    firePointer(window, "pointermove", { pointerId: 7, clientX: 22, clientY: 150 });
    expect(wrappers[0]!.classList.contains("ds-reorder-row--dragging")).toBe(true);
    expect((wrappers[1] as HTMLElement).style.transform).toBe("translateY(-72px)");

    firePointer(window, "pointerup", { pointerId: 7, clientX: 22, clientY: 150 });
    expect(onReorderItems).not.toHaveBeenCalled();

    // Клик сразу после drop глушится (отпускание мыши в конце drag не должно открывать sheet)
    fireEvent.click(screen.getAllByRole("button", { name: /^(Кофе|Молоко)/ })[0]!);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: /^(Кофе|Молоко)/ })[0]!);
    fireEvent.click(screen.getByRole("button", { name: "Готово" }));
    expect(onReorderItems).toHaveBeenCalledWith(["item-2", "item-1"]);
  });

  it("shows a sticky done bar in reorder mode and discards the draft on cancel", async () => {
    const onReorderItems = vi.fn().mockResolvedValue(undefined);
    render(<CategoriesView {...createProps({ onReorderItems, categorySortMode: "manual" })} />);
    expect(screen.queryByRole("button", { name: "Отмена" })).not.toBeInTheDocument();

    clickItemActionsButton();
    fireEvent.click(screen.getByRole("button", { name: "Изменить порядок" }));
    await waitFor(() => {
      expect(document.querySelectorAll(".ds-reorder-row")).toHaveLength(2);
    });
    expect(document.querySelector(".ds-reorder-bar")).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: /^(Кофе|Молоко)/ })[1]!);
    fireEvent.click(screen.getByRole("button", { name: "Вверх" }));
    expect(onReorderItems).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Отмена" }));
    expect(onReorderItems).not.toHaveBeenCalled();
    expect(document.querySelector(".ds-reorder-bar")).not.toBeInTheDocument();
    expect(document.querySelectorAll(".ds-reorder-row")).toHaveLength(0);
  });

  it("treats a short tap as a tap, not a drag", async () => {
    const onReorderItems = vi.fn().mockResolvedValue(undefined);
    render(<CategoriesView {...createProps({ onReorderItems, categorySortMode: "manual" })} />);
    clickItemActionsButton();
    fireEvent.click(screen.getByRole("button", { name: "Изменить порядок" }));
    await waitFor(() => {
      expect(document.querySelectorAll(".ds-reorder-row")).toHaveLength(2);
    });

    const wrappers = document.querySelectorAll(".ds-reorder-row");
    firePointer(wrappers[0]!, "pointerdown", { pointerId: 9, clientX: 20, clientY: 20 });
    firePointer(window, "pointerup", { pointerId: 9, clientX: 21, clientY: 22 });

    fireEvent.click(screen.getAllByRole("button", { name: /^(Кофе|Молоко)/ })[0]!);
    fireEvent.click(screen.getByRole("button", { name: "Готово" }));
    expect(onReorderItems).not.toHaveBeenCalled();
  });

  it("moves items within the visible subset when a status filter is active", async () => {
    const onReorderItems = vi.fn().mockResolvedValue(undefined);
    const itemC: Item = { ...itemLow, id: "item-3", name: "Сливки" };
    render(
      <CategoriesView
        {...createProps({
          onReorderItems,
          categorySortMode: "manual",
          visibleItems: [itemInStock, itemLow, itemC],
          statusFilter: "low"
        })}
      />
    );
    clickItemActionsButton();
    fireEvent.click(screen.getByRole("button", { name: "Изменить порядок" }));
    await waitFor(() => {
      expect(document.querySelectorAll(".ds-reorder-row")).toHaveLength(2);
    });

    fireEvent.click(screen.getByRole("button", { name: "Сливки" }));
    fireEvent.click(screen.getByRole("button", { name: "Вверх" }));
    fireEvent.click(screen.getByRole("button", { name: "Готово" }));
    expect(onReorderItems).toHaveBeenCalledWith(["item-1", "item-3", "item-2"]);
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
    clickItemActionsButton();
    fireEvent.click(screen.getByRole("button", { name: "Сортировать по статусу" }));
    await waitFor(() => {
      expect(onCategorySortModeChange).toHaveBeenCalledWith("status");
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("archives item when the row is swiped left past the commit threshold", async () => {
    let resolveArchive: (() => void) | undefined;
    const onArchiveItem = vi.fn().mockReturnValue(
      new Promise<void>((resolve) => {
        resolveArchive = resolve;
      })
    );
    render(<CategoriesView {...createProps({ onArchiveItem })} />);
    const row = document.querySelectorAll(".ds-swipe-row")[0]!;

    firePointer(row, "pointerdown", { pointerId: 11, clientX: 300, clientY: 30 });
    firePointer(window, "pointermove", { pointerId: 11, clientX: 220, clientY: 32 });
    expect(
      (row.querySelector(".ds-swipe-row__content") as HTMLElement).style.transform
    ).toBe("translateX(-80px)");

    firePointer(window, "pointerup", { pointerId: 11, clientX: 220, clientY: 32 });
    expect(onArchiveItem).toHaveBeenCalledWith(itemInStock);
    // Строка скрыта оптимистично, пока запрос в полёте
    expect(document.querySelectorAll(".ds-swipe-row")).toHaveLength(1);

    // Клик-«отпускание» в конце свайпа глушится (не должен открывать bottom-sheet)
    const remainingRow = document.querySelectorAll(".ds-swipe-row")[0]!;
    fireEvent.click(remainingRow.querySelector(".ds-swipe-row__content")!);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    resolveArchive!();
    await waitFor(() => {
      expect(document.querySelectorAll(".ds-swipe-row")).toHaveLength(2);
    });
  });

  it("snaps the row back when the swipe is below the commit threshold", () => {
    const onArchiveItem = vi.fn().mockResolvedValue(undefined);
    render(<CategoriesView {...createProps({ onArchiveItem })} />);
    const row = document.querySelectorAll(".ds-swipe-row")[0]!;

    firePointer(row, "pointerdown", { pointerId: 12, clientX: 300, clientY: 30 });
    firePointer(window, "pointermove", { pointerId: 12, clientX: 262, clientY: 31 });
    firePointer(window, "pointerup", { pointerId: 12, clientX: 262, clientY: 31 });

    expect(onArchiveItem).not.toHaveBeenCalled();
    expect(document.querySelectorAll(".ds-swipe-row")).toHaveLength(2);
    expect(
      (row.querySelector(".ds-swipe-row__content") as HTMLElement).style.transform
    ).toBe("");
  });

  it("treats a vertical gesture as scrolling, not a swipe", () => {
    const onArchiveItem = vi.fn().mockResolvedValue(undefined);
    render(<CategoriesView {...createProps({ onArchiveItem })} />);
    const row = document.querySelectorAll(".ds-swipe-row")[0]!;

    firePointer(row, "pointerdown", { pointerId: 13, clientX: 300, clientY: 30 });
    firePointer(window, "pointermove", { pointerId: 13, clientX: 302, clientY: 120 });
    firePointer(window, "pointerup", { pointerId: 13, clientX: 302, clientY: 120 });

    expect(onArchiveItem).not.toHaveBeenCalled();
    expect(
      (row.querySelector(".ds-swipe-row__content") as HTMLElement).style.transform
    ).toBe("");
  });

  it("archives item via the revealed swipe action button", () => {
    const onArchiveItem = vi.fn().mockResolvedValue(undefined);
    render(<CategoriesView {...createProps({ onArchiveItem })} />);
    fireEvent.click(screen.getAllByRole("button", { name: "В архив" })[0]!);
    expect(onArchiveItem).toHaveBeenCalledWith(itemInStock);
  });

  it("does not show status sort option when already sorting by status", () => {
    render(<CategoriesView {...createProps({ categorySortMode: "status" })} />);
    clickItemActionsButton();
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

  it("renders recommendations as compact cards with a single primary action", () => {
    render(<CategoriesView {...createProps({ visibleRecommendations: [recommendation] })} />);
    expect(screen.getByRole("button", { name: "Добавить" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Не нужно" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Скрыть похожие" })).not.toBeInTheDocument();
  });

  it("dismisses recommendation from the actions sheet", () => {
    const onDismissRecommendation = vi.fn().mockResolvedValue(undefined);
    render(
      <CategoriesView
        {...createProps({ visibleRecommendations: [recommendation], onDismissRecommendation })}
      />
    );
    const card = document.querySelector(".recommendation-row");
    expect(card).not.toBeNull();
    fireEvent.click(within(card as HTMLElement).getByRole("button", { name: "Ещё" }));
    fireEvent.click(screen.getByRole("button", { name: "Не нужно" }));
    expect(onDismissRecommendation).toHaveBeenCalledWith(recommendation);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("hides similar recommendations from the actions sheet", () => {
    const onHideSimilarRecommendations = vi.fn().mockResolvedValue(undefined);
    render(
      <CategoriesView
        {...createProps({
          visibleRecommendations: [recommendation],
          onHideSimilarRecommendations
        })}
      />
    );
    const card = document.querySelector(".recommendation-row");
    expect(card).not.toBeNull();
    fireEvent.click(within(card as HTMLElement).getByRole("button", { name: "Ещё" }));
    fireEvent.click(screen.getByRole("button", { name: "Скрыть похожие" }));
    expect(onHideSimilarRecommendations).toHaveBeenCalledWith(recommendation);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
