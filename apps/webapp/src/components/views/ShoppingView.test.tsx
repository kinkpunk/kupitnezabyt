import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import type { Category, Item, ShoppingListEntry } from "../../lib/types";
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
  category,
  item: null
};

const trackedItem: Item = {
  id: "item-1",
  userId: "user-1",
  categoryId: "cat-1",
  name: "Молоко",
  brand: null,
  notes: null,
  status: "LOW",
  importance: "NORMAL",
  usageCycleDays: 7,
  reminderEnabled: false,
  sortOrder: 0,
  lastCheckedAt: null,
  lastBoughtAt: null,
  nextCheckAt: null,
  archivedAt: null,
  category
};

const trackedEntry: ShoppingListEntry = {
  id: "entry-2",
  title: "Молоко",
  itemId: "item-1",
  categoryId: "cat-1",
  category,
  item: trackedItem
};

function createProps(overrides: Partial<React.ComponentProps<typeof ShoppingView>> = {}) {
  return {
    shoppingList: [manualEntry, trackedEntry],
    shoppingGroups: [{ id: "cat-1", title: "Еда", entries: [manualEntry, trackedEntry] }],
    categories: [category],
    manualShoppingTitle: "",
    setManualShoppingTitle: vi.fn(),
    manualShoppingCategoryId: "",
    setManualShoppingCategoryId: vi.fn(),
    showShoppingForm: false,
    setShowShoppingForm: vi.fn(),
    editingShoppingId: null,
    setEditingShoppingId: vi.fn(),
    editingShoppingTitle: "",
    setEditingShoppingTitle: vi.fn(),
    onCreateManualShoppingItem: vi.fn().mockResolvedValue(undefined),
    onUpdateManualShoppingItem: vi.fn().mockResolvedValue(undefined),
    onDeleteManualShoppingItem: vi.fn().mockResolvedValue(undefined),
    onCompleteShoppingListItem: vi.fn().mockResolvedValue(undefined),
    onUndoCompleteShoppingListItem: vi.fn().mockResolvedValue(undefined),
    onEditItemEntry: vi.fn(),
    onArchiveItem: vi.fn().mockResolvedValue(undefined),
    setError: vi.fn(),
    isActionPending: vi.fn().mockReturnValue(false),
    ...overrides
  };
}

describe("ShoppingView", () => {
  it("renders empty state when list is empty", () => {
    render(<ShoppingView {...createProps({ shoppingList: [], shoppingGroups: [] })} />);
    expect(screen.queryByRole("heading", { name: "Покупки" })).not.toBeInTheDocument();
    expect(screen.getByText("Список покупок пуст")).toBeInTheDocument();
  });

  it("opens create shopping sheet from the empty state CTA", () => {
    const setShowShoppingForm = vi.fn();
    render(
      <ShoppingView
        {...createProps({ shoppingList: [], shoppingGroups: [], setShowShoppingForm })}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Добавить покупку" }));
    expect(setShowShoppingForm).toHaveBeenCalledWith(true);
  });

  it("renders shopping groups and entries", () => {
    render(<ShoppingView {...createProps()} />);
    expect(screen.getByText("Хлеб")).toBeInTheDocument();
    expect(screen.getByText("Молоко")).toBeInTheDocument();
  });

  it("renders a sticky group title with a position count instead of per-row category subtitles", () => {
    render(<ShoppingView {...createProps()} />);
    const groupTitle = screen.getByRole("heading", { name: "Еда 2" });
    expect(groupTitle).toHaveClass("ds-shopping-group__title");
    expect(groupTitle.querySelector(".ds-shopping-group__count")).toHaveTextContent("2");
    expect(document.querySelector(".ds-shopping-group .ds-product-row__subtitle")).toBeNull();
  });

  it("keeps the row subtitle in the manual group to distinguish one-off and tracked entries", () => {
    render(
      <ShoppingView
        {...createProps({
          shoppingList: [manualEntry],
          shoppingGroups: [{ id: "manual", title: "Без категории", entries: [manualEntry] }]
        })}
      />
    );
    expect(screen.getByRole("heading", { name: "Без категории 1" })).toBeInTheDocument();
    expect(document.querySelector(".ds-shopping-group .ds-product-row__subtitle")).not.toBeNull();
  });

  it("opens create shopping sheet from the sticky panel header", () => {
    const setShowShoppingForm = vi.fn();
    render(<ShoppingView {...createProps({ setShowShoppingForm })} />);
    const addButton = screen.getByRole("button", { name: "Добавить покупку" });
    expect(addButton).toHaveClass("ds-button--solid");
    expect(addButton.closest(".ds-panel-header")).not.toBeNull();
    expect(document.querySelector(".ds-add-item-row")).not.toBeInTheDocument();
    fireEvent.click(addButton);
    expect(setShowShoppingForm).toHaveBeenCalledWith(true);
  });

  it("hides the panel add button when the list is empty", () => {
    render(<ShoppingView {...createProps({ shoppingList: [], shoppingGroups: [] })} />);
    expect(document.querySelector(".ds-panel-header")).not.toBeInTheDocument();
  });

  it("submits create manual item form", () => {
    const onCreateManualShoppingItem = vi.fn().mockResolvedValue(undefined);
    render(
      <ShoppingView
        {...createProps({
          showShoppingForm: true,
          manualShoppingTitle: "Сыр",
          manualShoppingCategoryId: "cat-1",
          onCreateManualShoppingItem
        })}
      />
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Добавить" }));
    expect(onCreateManualShoppingItem).toHaveBeenCalledOnce();
  });

  it("calls onCompleteShoppingListItem when bought checkbox is clicked", () => {
    const onCompleteShoppingListItem = vi.fn().mockResolvedValue(undefined);
    render(<ShoppingView {...createProps({ onCompleteShoppingListItem })} />);
    const boughtCheckboxes = screen.getAllByRole("checkbox", { name: "Куплено" });
    fireEvent.click(boughtCheckboxes[0]!);
    expect(onCompleteShoppingListItem).toHaveBeenCalledWith(manualEntry);
  });

  it("keeps the bought row in place with Куплено and Отмена, then removes it after the linger timeout", async () => {
    vi.useFakeTimers();
    try {
      const onCompleteShoppingListItem = vi.fn().mockResolvedValue(undefined);
      render(<ShoppingView {...createProps({ onCompleteShoppingListItem })} />);
      fireEvent.click(screen.getAllByRole("checkbox", { name: "Куплено" })[0] as HTMLElement);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      expect(screen.getByRole("status", { name: "Куплено" })).toBeInTheDocument();

      const rows = document.querySelectorAll(".ds-product-row");
      expect(rows[0]?.textContent).toContain("Хлеб");
      expect(rows[0]?.textContent).toContain("Куплено");
      expect(screen.getByRole("button", { name: "Отмена" })).toBeInTheDocument();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000);
      });
      expect(screen.queryByRole("status", { name: "Куплено" })).toBeNull();
      expect(screen.queryByRole("button", { name: "Отмена" })).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps the bought row in place when it was the last one in its group", async () => {
    const soloManual: ShoppingListEntry = {
      id: "entry-solo",
      title: "Соль",
      itemId: null,
      categoryId: null,
      category: null,
      item: null
    };

    function Wrapper() {
      const [entries, setEntries] = React.useState<ShoppingListEntry[]>([soloManual, manualEntry]);
      const groups = React.useMemo<Array<{ id: string; title: string; entries: ShoppingListEntry[] }>>(
        () => {
          const byId = new Map<string, { id: string; title: string; entries: ShoppingListEntry[] }>();
          for (const entry of entries) {
            const id = entry.category?.id ?? "manual";
            const group = byId.get(id);
            if (group) {
              group.entries.push(entry);
            } else {
              byId.set(id, {
                id,
                title: entry.category?.name ?? "Без категории",
                entries: [entry]
              });
            }
          }
          return [...byId.values()];
        },
        [entries]
      );

      return (
        <ShoppingView
          {...createProps({
            shoppingList: entries,
            shoppingGroups: groups,
            onCompleteShoppingListItem: async (entry: ShoppingListEntry) => {
              setEntries((current) => current.filter((candidate) => candidate.id !== entry.id));
            }
          })}
        />
      );
    }

    render(<Wrapper />);
    fireEvent.click(screen.getAllByRole("checkbox", { name: "Куплено" })[0] as HTMLElement);
    expect(await screen.findByRole("status", { name: "Куплено" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Отмена" })).toBeInTheDocument();
    const saltRow = screen.getByText("Соль").closest(".ds-product-row");
    const breadRow = screen.getByText("Хлеб").closest(".ds-product-row");
    expect(saltRow).not.toBeNull();
    expect(breadRow).not.toBeNull();
    expect(
      saltRow!.compareDocumentPosition(breadRow!) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it("calls onUndoCompleteShoppingListItem when Отмена is clicked on the bought row", async () => {
    const onCompleteShoppingListItem = vi.fn().mockResolvedValue(undefined);
    const onUndoCompleteShoppingListItem = vi.fn().mockResolvedValue(undefined);
    render(
      <ShoppingView
        {...createProps({ onCompleteShoppingListItem, onUndoCompleteShoppingListItem })}
      />
    );
    fireEvent.click(screen.getAllByRole("checkbox", { name: "Куплено" })[1] as HTMLElement);
    fireEvent.click(await screen.findByRole("button", { name: "Отмена" }));
    await waitFor(() => {
      expect(onUndoCompleteShoppingListItem).toHaveBeenCalledWith("entry-2", "LOW", null);
    });
    expect(screen.queryByRole("status", { name: "Куплено" })).toBeNull();
    expect(document.querySelector(".ds-shopping-actions--restoring")).not.toBeNull();
  });

  it("shows the bought state immediately, before the completion request resolves", async () => {
    let resolveComplete!: () => void;
    const onCompleteShoppingListItem = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveComplete = resolve;
        })
    );
    render(<ShoppingView {...createProps({ onCompleteShoppingListItem })} />);
    fireEvent.click(screen.getAllByRole("checkbox", { name: "Куплено" })[0] as HTMLElement);
    expect(screen.getByRole("status", { name: "Куплено" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Отмена" })).toBeInTheDocument();

    resolveComplete();
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByRole("status", { name: "Куплено" })).toBeInTheDocument();
  });

  it("rolls the bought row back and reports an error when the completion request fails", async () => {
    const onCompleteShoppingListItem = vi.fn().mockRejectedValue(new Error("Сеть недоступна"));
    const setError = vi.fn();
    render(<ShoppingView {...createProps({ onCompleteShoppingListItem, setError })} />);
    fireEvent.click(screen.getAllByRole("checkbox", { name: "Куплено" })[0] as HTMLElement);
    expect(screen.getByRole("status", { name: "Куплено" })).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.queryByRole("status", { name: "Куплено" })).toBeNull();
    });
    expect(screen.getAllByRole("checkbox", { name: "Куплено" })).toHaveLength(2);
    expect(setError).toHaveBeenCalledWith("Сеть недоступна");
  });

  it("waits for the in-flight completion before undoing it", async () => {
    let resolveComplete!: () => void;
    const onCompleteShoppingListItem = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveComplete = resolve;
        })
    );
    const onUndoCompleteShoppingListItem = vi.fn().mockResolvedValue(undefined);
    render(
      <ShoppingView
        {...createProps({ onCompleteShoppingListItem, onUndoCompleteShoppingListItem })}
      />
    );
    fireEvent.click(screen.getAllByRole("checkbox", { name: "Куплено" })[1] as HTMLElement);
    fireEvent.click(screen.getByRole("button", { name: "Отмена" }));
    expect(onUndoCompleteShoppingListItem).not.toHaveBeenCalled();

    resolveComplete();
    await waitFor(() => {
      expect(onUndoCompleteShoppingListItem).toHaveBeenCalledWith("entry-2", "LOW", null);
    });
  });

  it("skips the undo when the in-flight completion has already failed", async () => {
    let rejectComplete!: (error: Error) => void;
    const onCompleteShoppingListItem = vi.fn(
      () =>
        new Promise<void>((resolve, reject) => {
          rejectComplete = reject;
        })
    );
    const onUndoCompleteShoppingListItem = vi.fn().mockResolvedValue(undefined);
    const setError = vi.fn();
    render(
      <ShoppingView
        {...createProps({ onCompleteShoppingListItem, onUndoCompleteShoppingListItem, setError })}
      />
    );
    fireEvent.click(screen.getAllByRole("checkbox", { name: "Куплено" })[1] as HTMLElement);
    fireEvent.click(screen.getByRole("button", { name: "Отмена" }));

    rejectComplete(new Error("Сеть недоступна"));
    await waitFor(() => {
      expect(setError).toHaveBeenCalledWith("Сеть недоступна");
    });
    expect(onUndoCompleteShoppingListItem).not.toHaveBeenCalled();
    expect(screen.getAllByRole("checkbox", { name: "Куплено" })).toHaveLength(2);
  });

  it("ignores a duplicate completion tap while the row is already bought", async () => {
    let resolveComplete!: () => void;
    const onCompleteShoppingListItem = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveComplete = resolve;
        })
    );
    render(<ShoppingView {...createProps({ onCompleteShoppingListItem })} />);
    const checkbox = screen.getAllByRole("checkbox", { name: "Куплено" })[0] as HTMLElement;
    fireEvent.click(checkbox);
    fireEvent.click(checkbox);
    expect(onCompleteShoppingListItem).toHaveBeenCalledOnce();
    resolveComplete();
    await act(async () => {
      await Promise.resolve();
    });
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

  it("renders more button for tracked entries", () => {
    render(<ShoppingView {...createProps({ shoppingList: [trackedEntry], shoppingGroups: [{ id: "g1", title: "Список", entries: [trackedEntry] }] })} />);
    expect(screen.getByRole("button", { name: "Ещё" })).toBeInTheDocument();
  });

  it("shows edit and archive actions for tracked entries", async () => {
    const onEditItemEntry = vi.fn();
    const onArchiveItem = vi.fn().mockResolvedValue(undefined);
    render(<ShoppingView {...createProps({ onEditItemEntry, onArchiveItem })} />);
    const moreButtons = screen.getAllByRole("button", { name: "Ещё" });
    fireEvent.click(moreButtons[1]!);
    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "Редактировать" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "В архив" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Удалить" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Редактировать" }));
    expect(onEditItemEntry).toHaveBeenCalledWith(trackedItem);

    fireEvent.click(screen.getAllByRole("button", { name: "Ещё" })[1]!);
    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: "В архив" }));
    expect(onArchiveItem).toHaveBeenCalledWith(trackedItem);
  });

  it("renders a search field filtering entries by title", () => {
    render(<ShoppingView {...createProps()} />);
    const searchInput = screen.getByRole("searchbox", { name: "Поиск по покупкам" });
    fireEvent.change(searchInput, { target: { value: "Хлеб" } });
    expect(screen.getByText("Хлеб")).toBeInTheDocument();
    expect(screen.queryByText("Молоко")).not.toBeInTheDocument();
  });

  it("filters entries by category name", () => {
    render(<ShoppingView {...createProps()} />);
    const searchInput = screen.getByRole("searchbox", { name: "Поиск по покупкам" });
    fireEvent.change(searchInput, { target: { value: "еда" } });
    expect(screen.getByText("Хлеб")).toBeInTheDocument();
    expect(screen.getByText("Молоко")).toBeInTheDocument();
  });

  it("shows empty state when nothing matches the search query", () => {
    render(<ShoppingView {...createProps()} />);
    const searchInput = screen.getByRole("searchbox", { name: "Поиск по покупкам" });
    fireEvent.change(searchInput, { target: { value: "несуществующее" } });
    expect(screen.getByText("Ничего не найдено")).toBeInTheDocument();
    expect(screen.queryByText("Хлеб")).not.toBeInTheDocument();
  });

  it("keeps empty list state when search query is empty", () => {
    render(<ShoppingView {...createProps({ shoppingList: [], shoppingGroups: [] })} />);
    expect(screen.getByText("Список покупок пуст")).toBeInTheDocument();
    expect(screen.queryByText("Ничего не найдено")).not.toBeInTheDocument();
  });
});
