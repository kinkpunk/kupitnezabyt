import { fireEvent, render, screen, within } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import type { Category, CheckSession, InAppReminder, Item, ShoppingListEntry } from "../../lib/types";
import { HomeView } from "./HomeView";

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
  aggregateStatus: "ATTENTION"
};

const itemNeedBuy: Item = {
  id: "item-1",
  userId: "u1",
  categoryId: "cat-1",
  name: "Молоко",
  brand: null,
  notes: null,
  status: "NEED_BUY",
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

const categoryReminder: InAppReminder = {
  id: "rem-1",
  entityId: "cat-1",
  entityType: "CATEGORY",
  title: "Еда",
  nextCheckAt: "2026-09-05T00:00:00Z",
  timing: "DUE"
};

function createProps(overrides: Partial<React.ComponentProps<typeof HomeView>> = {}) {
  return {
    items: [itemNeedBuy],
    categories: [category],
    shoppingList: [] as ShoppingListEntry[],
    inAppReminders: [categoryReminder],
    checkSession: null as CheckSession | null,
    needBuyItems: [itemNeedBuy],
    onSelectTab: vi.fn(),
    onSelectCategory: vi.fn(),
    onSetStatus: vi.fn().mockResolvedValue(undefined),
    onStartReminderCheck: vi.fn().mockResolvedValue(undefined),
    onSnoozeReminder: vi.fn().mockResolvedValue(undefined),
    onOpenReminder: vi.fn(),
    isActionPending: vi.fn().mockReturnValue(false),
    ...overrides
  };
}

describe("HomeView", () => {
  it("renders summary as a static list with informative labels", () => {
    render(<HomeView {...createProps()} />);
    const summary = document.querySelector(".ds-home-summary");
    expect(summary).not.toBeNull();
    expect(summary?.closest("button")).toBeNull();
    expect(within(summary as HTMLElement).getByText("Купить сейчас")).toBeInTheDocument();
    expect(within(summary as HTMLElement).getByText("Мало осталось")).toBeInTheDocument();
    expect(within(summary as HTMLElement).getByText("Категории к проверке")).toBeInTheDocument();
    expect(within(summary as HTMLElement).getByText("Наборы к проверке")).toBeInTheDocument();
  });

  it("renders metric counts from items and reminders", () => {
    render(<HomeView {...createProps()} />);
    const summary = document.querySelector(".ds-home-summary") as HTMLElement;

    const metricValue = (label: string) =>
      within(summary).getByText(label).parentElement?.querySelector(
        ".ds-home-summary__metric-value"
      )?.textContent;

    expect(metricValue("Купить сейчас")).toBe("1");
    expect(metricValue("Мало осталось")).toBe("0");
    expect(metricValue("Категории к проверке")).toBe("1");
    expect(metricValue("Наборы к проверке")).toBe("0");
  });

  it("renders «Всё в порядке» when all counters are zero", () => {
    const itemInStock = { ...itemNeedBuy, status: "IN_STOCK" as const };
    render(
      <HomeView
        {...createProps({
          items: [itemInStock],
          needBuyItems: [],
          inAppReminders: []
        })}
      />
    );
    expect(screen.getByText("Всё в порядке")).toBeInTheDocument();
    expect(document.querySelector(".ds-home-summary__list")).toBeNull();
  });

  it("does not navigate anywhere from the static summary", () => {
    const onSelectTab = vi.fn();
    render(<HomeView {...createProps({ onSelectTab })} />);
    fireEvent.click(document.querySelector(".ds-home-summary") as HTMLElement);
    expect(onSelectTab).not.toHaveBeenCalled();
  });

  it("renders need-buy items and navigates on click", () => {
    const onSelectCategory = vi.fn();
    render(<HomeView {...createProps({ onSelectCategory })} />);
    const row = screen.getByRole("button", { name: "Молоко Еда Куплено" });
    expect(row).toBeInTheDocument();
    fireEvent.click(row);
    expect(onSelectCategory).toHaveBeenCalledWith(itemNeedBuy.categoryId);
  });

  it("marks need-buy item as bought via Куплено button", () => {
    const onSetStatus = vi.fn().mockResolvedValue(undefined);
    const onSelectCategory = vi.fn();
    render(<HomeView {...createProps({ onSetStatus, onSelectCategory })} />);
    fireEvent.click(screen.getByRole("button", { name: "Куплено" }));
    expect(onSetStatus).toHaveBeenCalledWith(itemNeedBuy, "IN_STOCK");
    expect(onSelectCategory).not.toHaveBeenCalled();
  });

  it("shows pending state on Куплено button while status update is in flight", () => {
    render(
      <HomeView
        {...createProps({ isActionPending: (key: string) => key === "item:status:item-1" })}
      />
    );
    const button = screen.getByRole("button", { name: "Отмечаем..." });
    expect(button).toBeDisabled();
  });

  it("shows empty state when there are no need-buy items", () => {
    render(<HomeView {...createProps({ needBuyItems: [] })} />);
    expect(document.querySelector(".ds-empty-state")?.textContent).toContain("Пока спокойно");
  });

  it("renders reminders grouped by entity type", () => {
    render(<HomeView {...createProps()} />);
    const group = screen.getByRole("region", { name: "Напоминания категорий" });
    expect(group).toBeInTheDocument();
    expect(within(group).getByRole("heading", { name: "Категории" })).toBeInTheDocument();
    expect(within(group).getByText("Еда")).toBeInTheDocument();
  });

  it("calls onOpenReminder when reminder row is clicked", () => {
    const onOpenReminder = vi.fn();
    render(<HomeView {...createProps({ onOpenReminder })} />);
    const row = screen.getByRole("button", { name: /Еда Категория/ });
    fireEvent.click(row);
    expect(onOpenReminder).toHaveBeenCalledWith(categoryReminder);
  });

  it("calls onStartReminderCheck for category reminder", () => {
    const onStartReminderCheck = vi.fn().mockResolvedValue(undefined);
    render(<HomeView {...createProps({ onStartReminderCheck })} />);
    fireEvent.click(screen.getByRole("button", { name: "Проверить" }));
    expect(onStartReminderCheck).toHaveBeenCalledWith(categoryReminder);
  });

  it("calls onSnoozeReminder when snooze is clicked", () => {
    const onSnoozeReminder = vi.fn().mockResolvedValue(undefined);
    render(<HomeView {...createProps({ onSnoozeReminder })} />);
    fireEvent.click(screen.getByRole("button", { name: "Отложить" }));
    expect(onSnoozeReminder).toHaveBeenCalledWith(categoryReminder);
  });

  it("renders in-progress check session section", () => {
    const checkSession: CheckSession = {
      id: "check-1",
      categoryId: "cat-1",
      groupId: null,
      status: "IN_PROGRESS",
      startedAt: "2026-09-01T00:00:00Z",
      completedAt: null,
      category,
      group: null,
      items: [
        { id: "ci-1", sessionId: "check-1", itemId: "item-1", sortOrder: 0, selectedStatus: null, checkedAt: null, item: itemNeedBuy }
      ]
    };
    render(<HomeView {...createProps({ checkSession })} />);
    expect(screen.getByRole("heading", { name: "Проверка" })).toBeInTheDocument();
    expect(screen.getByText("1 из 1")).toBeInTheDocument();
  });
});
