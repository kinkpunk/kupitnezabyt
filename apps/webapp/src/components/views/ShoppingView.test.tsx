import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import type { Category, ShoppingListEntry } from "../../lib/types";
import { ShoppingView } from "./ShoppingView";

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

const manualEntry: ShoppingListEntry = {
  id: "entry-1",
  title: "Хлеб",
  itemId: null,
  categoryId: "cat-1",
  priority: "NORMAL",
  category,
  item: null
};

const trackedEntry: ShoppingListEntry = {
  id: "entry-2",
  title: "Молоко",
  itemId: "item-1",
  categoryId: "cat-1",
  priority: "URGENT",
  category,
  item: null
};

function createProps(overrides: Partial<React.ComponentProps<typeof ShoppingView>> = {}) {
  return {
    shoppingList: [manualEntry, trackedEntry],
    shoppingGroups: [{ id: "group-1", title: "Список", entries: [manualEntry, trackedEntry] }],
    categories: [category],
    manualShoppingTitle: "",
    setManualShoppingTitle: vi.fn(),
    manualShoppingCategoryId: "",
    setManualShoppingCategoryId: vi.fn(),
    manualShoppingPriority: "NORMAL" as const,
    setManualShoppingPriority: vi.fn(),
    editingShoppingId: null,
    setEditingShoppingId: vi.fn(),
    editingShoppingTitle: "",
    setEditingShoppingTitle: vi.fn(),
    onCreateManualShoppingItem: vi.fn().mockResolvedValue(undefined),
    onUpdateManualShoppingItem: vi.fn().mockResolvedValue(undefined),
    onDeleteManualShoppingItem: vi.fn().mockResolvedValue(undefined),
    onCompleteShoppingListItem: vi.fn().mockResolvedValue(undefined),
    onClearCompletedShoppingList: vi.fn().mockResolvedValue(undefined),
    setError: vi.fn(),
    isActionPending: vi.fn().mockReturnValue(false),
    ...overrides
  };
}

describe("ShoppingView", () => {
  it("renders header and empty state when list is empty", () => {
    render(<ShoppingView {...createProps({ shoppingList: [], shoppingGroups: [] })} />);
    expect(screen.getByRole("heading", { name: "Покупки" })).toBeInTheDocument();
    expect(screen.getByText("Список покупок пуст")).toBeInTheDocument();
  });

  it("renders shopping groups and entries", () => {
    render(<ShoppingView {...createProps()} />);
    expect(screen.getByRole("heading", { name: "Список" })).toBeInTheDocument();
    expect(screen.getByText("Хлеб")).toBeInTheDocument();
    expect(screen.getByText("Молоко")).toBeInTheDocument();
  });

  it("submits create manual item form", () => {
    const onCreateManualShoppingItem = vi.fn().mockResolvedValue(undefined);
    render(
      <ShoppingView
        {...createProps({
          manualShoppingTitle: "Сыр",
          manualShoppingCategoryId: "cat-1",
          onCreateManualShoppingItem
        })}
      />
    );
    fireEvent.submit(document.querySelector(".ds-shopping-form")!);
    expect(onCreateManualShoppingItem).toHaveBeenCalledOnce();
  });

  it("calls onCompleteShoppingListItem when bought button is clicked", () => {
    const onCompleteShoppingListItem = vi.fn().mockResolvedValue(undefined);
    render(<ShoppingView {...createProps({ onCompleteShoppingListItem })} />);
    const boughtButtons = screen.getAllByRole("button", { name: "Куплено" });
    fireEvent.click(boughtButtons[0]!);
    expect(onCompleteShoppingListItem).toHaveBeenCalledWith(manualEntry);
  });

  it("shows clear completed button when list is not empty", () => {
    const onClearCompletedShoppingList = vi.fn().mockResolvedValue(undefined);
    render(<ShoppingView {...createProps({ onClearCompletedShoppingList })} />);
    fireEvent.click(screen.getByRole("button", { name: "Очистить" }));
    expect(onClearCompletedShoppingList).toHaveBeenCalledOnce();
  });

  it("opens entry actions sheet for manual entries", async () => {
    render(<ShoppingView {...createProps()} />);
    const moreButtons = screen.getAllByRole("button", { name: "Ещё" });
    fireEvent.click(moreButtons[0]!);
    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "Редактировать" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Удалить" })).toBeInTheDocument();
  });

  it("starts editing entry from actions sheet", async () => {
    const setEditingShoppingId = vi.fn();
    const setEditingShoppingTitle = vi.fn();
    render(
      <ShoppingView
        {...createProps({
          setEditingShoppingId,
          setEditingShoppingTitle
        })}
      />
    );
    const moreButtons = screen.getAllByRole("button", { name: "Ещё" });
    fireEvent.click(moreButtons[0]!);
    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: "Редактировать" }));
    expect(setEditingShoppingId).toHaveBeenCalledWith(manualEntry.id);
    expect(setEditingShoppingTitle).toHaveBeenCalledWith(manualEntry.title);
  });

  it("deletes entry from actions sheet", async () => {
    const onDeleteManualShoppingItem = vi.fn().mockResolvedValue(undefined);
    render(<ShoppingView {...createProps({ onDeleteManualShoppingItem })} />);
    const moreButtons = screen.getAllByRole("button", { name: "Ещё" });
    fireEvent.click(moreButtons[0]!);
    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: "Удалить" }));
    expect(onDeleteManualShoppingItem).toHaveBeenCalledWith(manualEntry);
  });

  it("submits edit form", () => {
    const onUpdateManualShoppingItem = vi.fn().mockResolvedValue(undefined);
    render(
      <ShoppingView
        {...createProps({
          editingShoppingId: manualEntry.id,
          editingShoppingTitle: "Багет",
          onUpdateManualShoppingItem
        })}
      />
    );
    fireEvent.submit(document.querySelector(".ds-product-row__edit")!);
    expect(onUpdateManualShoppingItem).toHaveBeenCalledWith(manualEntry);
  });

  it("does not render more button for tracked entries", () => {
    render(<ShoppingView {...createProps({ shoppingList: [trackedEntry], shoppingGroups: [{ id: "g1", title: "Список", entries: [trackedEntry] }] })} />);
    expect(screen.queryByRole("button", { name: "Ещё" })).not.toBeInTheDocument();
  });
});
