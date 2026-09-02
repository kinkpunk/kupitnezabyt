import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import type { Category, Item } from "../../lib/types";
import { ArchiveView } from "./ArchiveView";

const archivedCategory: Category = {
  id: "cat-arch",
  name: "Дача",
  icon: "🏡",
  sortOrder: 0,
  usageCycleDays: null,
  nextCheckAt: null,
  reminderEnabled: false,
  archivedAt: "2026-08-15T00:00:00Z",
  itemCount: 3,
  aggregateStatus: "OK"
};

const archivedItem: Item = {
  id: "item-arch",
  userId: "u1",
  categoryId: "cat-1",
  name: "Лопата",
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
  archivedAt: "2026-08-10T00:00:00Z",
  category: { id: "cat-1", name: "Дом" } as Category
};

function createProps(overrides: Partial<React.ComponentProps<typeof ArchiveView>> = {}) {
  return {
    archivedCategories: [archivedCategory],
    archivedStandaloneItems: [archivedItem],
    onRestoreCategory: vi.fn().mockResolvedValue(undefined),
    onDeleteArchivedCategory: vi.fn().mockResolvedValue(undefined),
    onRestoreItem: vi.fn().mockResolvedValue(undefined),
    onDeleteArchivedItem: vi.fn().mockResolvedValue(undefined),
    setError: vi.fn(),
    ...overrides
  };
}

describe("ArchiveView", () => {
  it("renders empty state when archive is empty", () => {
    render(<ArchiveView {...createProps({ archivedCategories: [], archivedStandaloneItems: [] })} />);
    expect(screen.getByRole("heading", { name: "Архив" })).toBeInTheDocument();
    expect(screen.getByText("Архив пуст")).toBeInTheDocument();
  });

  it("renders archived categories and items counts", () => {
    render(<ArchiveView {...createProps()} />);
    expect(screen.getByText("1 кат. · 1 тов.")).toBeInTheDocument();
    expect(screen.getByText("🏡 Дача")).toBeInTheDocument();
    expect(screen.getByText("Лопата")).toBeInTheDocument();
  });

  it("restores archived category", () => {
    const onRestoreCategory = vi.fn().mockResolvedValue(undefined);
    render(<ArchiveView {...createProps({ onRestoreCategory })} />);
    const buttons = screen.getAllByRole("button", { name: "Вернуть" });
    fireEvent.click(buttons[0]!);
    expect(onRestoreCategory).toHaveBeenCalledWith(archivedCategory);
  });

  it("deletes archived category", () => {
    const onDeleteArchivedCategory = vi.fn().mockResolvedValue(undefined);
    render(<ArchiveView {...createProps({ onDeleteArchivedCategory })} />);
    const buttons = screen.getAllByRole("button", { name: "Удалить" });
    fireEvent.click(buttons[0]!);
    expect(onDeleteArchivedCategory).toHaveBeenCalledWith(archivedCategory);
  });

  it("restores archived item", () => {
    const onRestoreItem = vi.fn().mockResolvedValue(undefined);
    render(<ArchiveView {...createProps({ onRestoreItem })} />);
    const buttons = screen.getAllByRole("button", { name: "Вернуть" });
    fireEvent.click(buttons[1]!);
    expect(onRestoreItem).toHaveBeenCalledWith(archivedItem);
  });

  it("deletes archived item", () => {
    const onDeleteArchivedItem = vi.fn().mockResolvedValue(undefined);
    render(<ArchiveView {...createProps({ onDeleteArchivedItem })} />);
    const buttons = screen.getAllByRole("button", { name: "Удалить" });
    fireEvent.click(buttons[1]!);
    expect(onDeleteArchivedItem).toHaveBeenCalledWith(archivedItem);
  });
});
