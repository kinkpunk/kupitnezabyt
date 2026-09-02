import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import type { Category, CheckSession, CheckSessionItem, Item } from "../../lib/types";
import { CheckView } from "./CheckView";

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

const emptyCategory: Category = {
  ...category,
  id: "cat-empty",
  name: "Пустая",
  itemCount: 0
};

const item: Item = {
  id: "item-1",
  userId: "u1",
  categoryId: "cat-1",
  name: "Кофе",
  brand: null,
  notes: null,
  status: "LOW",
  importance: "NORMAL",
  usageCycleDays: null,
  reminderEnabled: false,
  sortOrder: 0,
  lastCheckedAt: null,
  lastBoughtAt: null,
  nextCheckAt: null,
  archivedAt: null
};

function createProps(overrides: Partial<React.ComponentProps<typeof CheckView>> = {}) {
  return {
    checkSession: null as CheckSession | null,
    checkedCount: 0,
    currentCheckItem: null as CheckSessionItem | null,
    pendingCheckItemName: null as string | null,
    selectedCategory: category,
    categories: [category, emptyCategory],
    onCancelCheck: vi.fn().mockResolvedValue(undefined),
    onStartCategoryCheck: vi.fn().mockResolvedValue(undefined),
    onCheckStatus: vi.fn().mockResolvedValue(undefined),
    onClearSearchSession: vi.fn(),
    onSelectCategory: vi.fn(),
    setError: vi.fn(),
    ...overrides
  };
}

describe("CheckView", () => {
  it("renders category selector and start button", () => {
    render(<CheckView {...createProps()} />);
    expect(screen.getByRole("heading", { name: "Проверка" })).toBeInTheDocument();
    expect(screen.getByLabelText("Категория для проверки")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Начать" })).toBeInTheDocument();
  });

  it("starts check for selected category", () => {
    const onStartCategoryCheck = vi.fn().mockResolvedValue(undefined);
    render(<CheckView {...createProps({ onStartCategoryCheck })} />);
    fireEvent.submit(document.querySelector(".ds-check-form")!);
    expect(onStartCategoryCheck).toHaveBeenCalledOnce();
  });

  it("disables start when no category selected", () => {
    render(<CheckView {...createProps({ selectedCategory: null })} />);
    expect(screen.getByRole("button", { name: "Начать" })).toBeDisabled();
  });

  it("disables start when category has no items", () => {
    render(<CheckView {...createProps({ selectedCategory: emptyCategory })} />);
    expect(screen.getByRole("button", { name: "Начать" })).toBeDisabled();
  });

  it("calls onSelectCategory when selector changes", () => {
    const onSelectCategory = vi.fn();
    render(<CheckView {...createProps({ onSelectCategory })} />);
    fireEvent.change(screen.getByLabelText("Категория для проверки"), {
      target: { value: emptyCategory.id }
    });
    expect(onSelectCategory).toHaveBeenCalledWith(emptyCategory.id);
  });

  it("renders current check item and status buttons", () => {
    const checkSession: CheckSession = {
      id: "check-1",
      categoryId: category.id,
      groupId: null,
      status: "IN_PROGRESS",
      startedAt: "2026-09-01T00:00:00Z",
      completedAt: null,
      category,
      group: null,
      items: [
        { id: "ci-1", sessionId: "check-1", itemId: item.id, sortOrder: 0, selectedStatus: null, checkedAt: null, item }
      ]
    };
    render(
      <CheckView
        {...createProps({
          checkSession,
          currentCheckItem: checkSession.items[0]!
        })}
      />
    );
    expect(screen.getByText("Кофе")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Есть" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Мало" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Купить" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Срочно" })).toBeInTheDocument();
  });

  it("calls onCheckStatus when status button is clicked", () => {
    const onCheckStatus = vi.fn().mockResolvedValue(undefined);
    const checkSession: CheckSession = {
      id: "check-1",
      categoryId: category.id,
      groupId: null,
      status: "IN_PROGRESS",
      startedAt: "2026-09-01T00:00:00Z",
      completedAt: null,
      category,
      group: null,
      items: [
        { id: "ci-1", sessionId: "check-1", itemId: item.id, sortOrder: 0, selectedStatus: null, checkedAt: null, item }
      ]
    };
    render(
      <CheckView
        {...createProps({
          onCheckStatus,
          checkSession,
          currentCheckItem: checkSession.items[0]!
        })}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Есть" }));
    expect(onCheckStatus).toHaveBeenCalledWith("IN_STOCK");
  });

  it("calls onCancelCheck when cancel is clicked", () => {
    const onCancelCheck = vi.fn().mockResolvedValue(undefined);
    const checkSession: CheckSession = {
      id: "check-1",
      categoryId: category.id,
      groupId: null,
      status: "IN_PROGRESS",
      startedAt: "2026-09-01T00:00:00Z",
      completedAt: null,
      category,
      group: null,
      items: []
    };
    render(<CheckView {...createProps({ onCancelCheck, checkSession })} />);
    fireEvent.click(screen.getByRole("button", { name: "Отмена" }));
    expect(onCancelCheck).toHaveBeenCalledOnce();
  });

  it("renders completed empty state", () => {
    const checkSession: CheckSession = {
      id: "check-1",
      categoryId: category.id,
      groupId: null,
      status: "COMPLETED",
      startedAt: "2026-09-01T00:00:00Z",
      completedAt: "2026-09-01T01:00:00Z",
      category,
      group: null,
      items: []
    };
    render(<CheckView {...createProps({ checkSession })} />);
    expect(screen.getByText("Проверка завершена")).toBeInTheDocument();
  });

  it("renders cancelled empty state", () => {
    const checkSession: CheckSession = {
      id: "check-1",
      categoryId: category.id,
      groupId: null,
      status: "CANCELLED",
      startedAt: "2026-09-01T00:00:00Z",
      completedAt: null,
      category,
      group: null,
      items: []
    };
    render(<CheckView {...createProps({ checkSession })} />);
    expect(screen.getByText("Проверка отменена")).toBeInTheDocument();
  });
});
