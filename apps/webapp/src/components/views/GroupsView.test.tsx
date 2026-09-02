import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import type { Category, Item, ItemGroup, ItemGroupItem } from "../../lib/types";
import { GroupsView } from "./GroupsView";

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

const groupItem: ItemGroupItem = {
  id: "gi-1",
  groupId: "group-1",
  itemId: item.id,
  createdAt: "2026-09-01T00:00:00Z",
  item
};

const group: ItemGroup = {
  id: "group-1",
  name: "Завтрак",
  icon: null,
  usageCycleDays: 7,
  nextCheckAt: null,
  reminderEnabled: false,
  createdAt: "2026-09-01T00:00:00Z",
  updatedAt: "2026-09-01T00:00:00Z",
  archivedAt: null,
  items: [groupItem]
};

function createProps(overrides: Partial<React.ComponentProps<typeof GroupsView>> = {}) {
  return {
    groups: [group],
    selectedGroup: group,
    groupName: "",
    setGroupName: vi.fn(),
    groupItemId: "",
    setGroupItemId: vi.fn(),
    items: [item],
    selectedGroupCheckItemCount: 1,
    onCreateGroup: vi.fn().mockResolvedValue(undefined),
    onArchiveSelectedGroup: vi.fn().mockResolvedValue(undefined),
    onAddGroupItem: vi.fn().mockResolvedValue(undefined),
    onRemoveGroupItem: vi.fn().mockResolvedValue(undefined),
    onStartGroupCheck: vi.fn().mockResolvedValue(undefined),
    onSelectGroup: vi.fn(),
    setError: vi.fn(),
    isActionPending: vi.fn().mockReturnValue(false),
    ...overrides
  };
}

describe("GroupsView", () => {
  it("renders empty state when no groups", () => {
    render(
      <GroupsView
        {...createProps({
          groups: [],
          selectedGroup: null
        })}
      />
    );
    expect(screen.getByRole("heading", { name: "Наборы" })).toBeInTheDocument();
    expect(screen.getByText("Нет выбранного набора")).toBeInTheDocument();
  });

  it("submits create group form", () => {
    const onCreateGroup = vi.fn().mockResolvedValue(undefined);
    render(<GroupsView {...createProps({ groupName: "Ужин", onCreateGroup })} />);
    fireEvent.submit(document.querySelector(".ds-groups-create-form")!);
    expect(onCreateGroup).toHaveBeenCalledOnce();
  });

  it("renders group tabs and selects group", () => {
    const onSelectGroup = vi.fn();
    render(<GroupsView {...createProps({ onSelectGroup })} />);
    const tab = screen.getByRole("tab", { name: "Завтрак" });
    expect(tab).toHaveAttribute("aria-selected", "true");
    fireEvent.click(tab);
    expect(onSelectGroup).toHaveBeenCalledWith(group.id);
  });

  it("renders selected group items", () => {
    render(<GroupsView {...createProps()} />);
    expect(screen.getByRole("heading", { name: "Завтрак" })).toBeInTheDocument();
    expect(screen.getByText("Кофе")).toBeInTheDocument();
  });

  it("submits add item form", () => {
    const onAddGroupItem = vi.fn().mockResolvedValue(undefined);
    render(<GroupsView {...createProps({ groupItemId: item.id, onAddGroupItem })} />);
    fireEvent.submit(document.querySelector(".ds-groups-add-form")!);
    expect(onAddGroupItem).toHaveBeenCalledOnce();
  });

  it("removes item from group", () => {
    const onRemoveGroupItem = vi.fn().mockResolvedValue(undefined);
    render(<GroupsView {...createProps({ onRemoveGroupItem })} />);
    fireEvent.click(screen.getByRole("button", { name: "Убрать" }));
    expect(onRemoveGroupItem).toHaveBeenCalledWith(item.id);
  });

  it("starts group check", () => {
    const onStartGroupCheck = vi.fn().mockResolvedValue(undefined);
    render(<GroupsView {...createProps({ onStartGroupCheck })} />);
    fireEvent.click(screen.getByRole("button", { name: "Проверить" }));
    expect(onStartGroupCheck).toHaveBeenCalledOnce();
  });

  it("disables check when there are no checkable items", () => {
    render(<GroupsView {...createProps({ selectedGroupCheckItemCount: 0 })} />);
    expect(screen.getByRole("button", { name: "Проверить" })).toBeDisabled();
  });

  it("archives selected group", () => {
    const onArchiveSelectedGroup = vi.fn().mockResolvedValue(undefined);
    render(<GroupsView {...createProps({ onArchiveSelectedGroup })} />);
    fireEvent.click(screen.getByRole("button", { name: "Архив" }));
    expect(onArchiveSelectedGroup).toHaveBeenCalledOnce();
  });

  it("shows empty state for empty selected group", () => {
    render(
      <GroupsView
        {...createProps({
          selectedGroup: { ...group, items: [] }
        })}
      />
    );
    expect(screen.getByText("Набор пуст")).toBeInTheDocument();
  });
});
