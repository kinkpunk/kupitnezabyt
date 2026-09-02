import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import type { Category, InAppReminder, ShoppingListEntry } from "../lib/types";
import { NotificationSheet } from "./NotificationSheet";

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

const shoppingEntry: ShoppingListEntry = {
  id: "se-1",
  title: "Молоко",
  itemId: null,
  categoryId: "cat-1",
  priority: "URGENT",
  category,
  item: null
};

const reminder: InAppReminder = {
  id: "rem-1",
  entityId: "cat-1",
  entityType: "CATEGORY",
  title: "Проверить еду",
  nextCheckAt: "2026-09-05T00:00:00Z",
  timing: "DUE"
};

function createProps(overrides: Partial<React.ComponentProps<typeof NotificationSheet>> = {}) {
  return {
    show: true,
    shoppingList: [shoppingEntry],
    inAppReminders: [reminder],
    onClose: vi.fn(),
    onOpenShoppingEntry: vi.fn(),
    onOpenReminder: vi.fn(),
    ...overrides
  };
}

describe("NotificationSheet", () => {
  it("does not render when show is false", () => {
    render(<NotificationSheet {...createProps({ show: false })} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders empty state when no notifications", () => {
    render(<NotificationSheet {...createProps({ shoppingList: [], inAppReminders: [] })} />);
    expect(screen.getByText("Нет уведомлений")).toBeInTheDocument();
  });

  it("renders shopping list and reminders", () => {
    render(<NotificationSheet {...createProps()} />);
    expect(screen.getByText("Молоко")).toBeInTheDocument();
    expect(screen.getByText("Проверить еду")).toBeInTheDocument();
  });

  it("calls onOpenShoppingEntry and closes sheet", () => {
    const onOpenShoppingEntry = vi.fn();
    const onClose = vi.fn();
    render(
      <NotificationSheet
        {...createProps({ onOpenShoppingEntry, onClose })}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /Молоко/ }));
    expect(onClose).toHaveBeenCalledOnce();
    expect(onOpenShoppingEntry).toHaveBeenCalledWith(shoppingEntry);
  });

  it("calls onOpenReminder and closes sheet", () => {
    const onOpenReminder = vi.fn();
    const onClose = vi.fn();
    render(<NotificationSheet {...createProps({ onOpenReminder, onClose })} />);
    fireEvent.click(screen.getByRole("button", { name: /Проверить еду/ }));
    expect(onClose).toHaveBeenCalledOnce();
    expect(onOpenReminder).toHaveBeenCalledWith(reminder);
  });
});
