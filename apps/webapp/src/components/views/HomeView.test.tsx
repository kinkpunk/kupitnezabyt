import { fireEvent, render, screen, within } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import type { Category, CheckSession, InAppReminder, Item } from "../../lib/types";
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

const itemLow: Item = {
  ...itemNeedBuy,
  id: "item-2",
  name: "Хлеб",
  status: "LOW",
  sortOrder: 1
};

const itemInStock: Item = {
  ...itemNeedBuy,
  id: "item-3",
  name: "Кофе",
  status: "IN_STOCK",
  sortOrder: 2
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
    items: [itemNeedBuy, itemLow, itemInStock],
    inAppReminders: [categoryReminder],
    checkSession: null as CheckSession | null,
    onSelectTab: vi.fn(),
    onStartReminderCheck: vi.fn().mockResolvedValue(undefined),
    onSnoozeReminder: vi.fn().mockResolvedValue(undefined),
    onOpenReminder: vi.fn(),
    onOpenShopping: vi.fn(),
    onOpenLowItems: vi.fn(),
    onOpenChecks: vi.fn(),
    isActionPending: vi.fn().mockReturnValue(false),
    ...overrides
  };
}

describe("HomeView", () => {
  it("renders the dashboard with status rows and counts", () => {
    render(<HomeView {...createProps()} />);
    const summary = screen.getByLabelText("Сводка");

    const metricValue = (label: string) =>
      within(summary).getByText(label).parentElement?.parentElement?.querySelector(
        ".ds-home-summary__metric-value"
      )?.textContent;

    expect(metricValue("Есть")).toBe("1");
    expect(metricValue("Мало")).toBe("1");
    expect(metricValue("Нет")).toBe("1");
    expect(metricValue("К проверке")).toBe("1");
  });

  it("renders the status bar with one segment per present status", () => {
    render(<HomeView {...createProps()} />);
    const bar = document.querySelector(".ds-home-summary__bar");
    expect(bar).not.toBeNull();
    expect(bar?.getAttribute("aria-hidden")).toBe("true");
    expect(bar?.querySelectorAll(".ds-home-summary__bar-segment")).toHaveLength(3);
  });

  it("ignores paused items in the dashboard", () => {
    const itemPaused = { ...itemNeedBuy, id: "item-4", status: "PAUSED" as const };
    render(<HomeView {...createProps({ items: [itemPaused], inAppReminders: [] })} />);
    expect(screen.getByText("Всё в порядке")).toBeInTheDocument();
    expect(document.querySelector(".ds-home-summary__bar")).toBeNull();
  });

  it("renders «Всё в порядке» when there are no active items and reminders", () => {
    render(<HomeView {...createProps({ items: [], inAppReminders: [] })} />);
    expect(screen.getByText("Всё в порядке")).toBeInTheDocument();
    expect(document.querySelector(".ds-home-summary__list")).toBeNull();
  });

  it("opens shopping from the Нет row and low items from the Мало row", () => {
    const onOpenShopping = vi.fn();
    const onOpenLowItems = vi.fn();
    render(<HomeView {...createProps({ onOpenShopping, onOpenLowItems })} />);

    fireEvent.click(screen.getByRole("button", { name: "Нет 1" }));
    expect(onOpenShopping).toHaveBeenCalledOnce();
    expect(onOpenLowItems).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Мало 1" }));
    expect(onOpenLowItems).toHaveBeenCalledOnce();
  });

  it("opens the check screen from the К проверке row", () => {
    const onOpenChecks = vi.fn();
    render(<HomeView {...createProps({ onOpenChecks })} />);
    fireEvent.click(screen.getByRole("button", { name: "К проверке 1" }));
    expect(onOpenChecks).toHaveBeenCalledOnce();
  });

  it("renders zero-count rows as non-interactive", () => {
    render(<HomeView {...createProps({ items: [itemInStock] })} />);
    const summary = screen.getByLabelText("Сводка");
    expect(within(summary).queryByRole("button", { name: "Мало 0" })).toBeNull();
    expect(within(summary).queryByRole("button", { name: "Нет 0" })).toBeNull();
    const inStockRow = within(summary).getByText("Есть").parentElement?.parentElement;
    expect(inStockRow?.querySelector(".ds-home-summary__chevron--hidden")).not.toBeNull();
  });

  it("does not render the Купить сейчас section", () => {
    render(<HomeView {...createProps()} />);
    expect(screen.queryByRole("heading", { name: "Купить сейчас" })).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: "Куплено" })).not.toBeInTheDocument();
  });

  it("navigates to checks from the Проверки empty state CTA", () => {
    const onSelectTab = vi.fn();
    render(<HomeView {...createProps({ inAppReminders: [], onSelectTab })} />);
    fireEvent.click(screen.getByRole("button", { name: "Начать проверку" }));
    expect(onSelectTab).toHaveBeenCalledWith("check");
  });

  it("renders reminders in the checks section", () => {
    render(<HomeView {...createProps()} />);
    const section = screen.getByRole("heading", { name: "Проверки" }).closest("section");
    expect(section).not.toBeNull();
    expect(within(section as HTMLElement).getByText("Еда")).toBeInTheDocument();
  });

  it("calls onOpenReminder when reminder row is clicked", () => {
    const onOpenReminder = vi.fn();
    render(<HomeView {...createProps({ onOpenReminder })} />);
    const section = screen.getByRole("heading", { name: "Проверки" }).closest("section");
    const row = within(section as HTMLElement).getByRole("button", { name: "Еда" });
    fireEvent.click(row);
    expect(onOpenReminder).toHaveBeenCalledWith(categoryReminder);
  });

  it("calls onStartReminderCheck for category reminder without opening the reminder", () => {
    const onStartReminderCheck = vi.fn().mockResolvedValue(undefined);
    const onOpenReminder = vi.fn();
    render(<HomeView {...createProps({ onStartReminderCheck, onOpenReminder })} />);
    fireEvent.click(screen.getByRole("button", { name: "Проверить" }));
    expect(onStartReminderCheck).toHaveBeenCalledWith(categoryReminder);
    expect(onOpenReminder).not.toHaveBeenCalled();
  });

  it("calls onSnoozeReminder when snooze is clicked without opening the reminder", () => {
    const onSnoozeReminder = vi.fn().mockResolvedValue(undefined);
    const onOpenReminder = vi.fn();
    render(<HomeView {...createProps({ onSnoozeReminder, onOpenReminder })} />);
    fireEvent.click(screen.getByRole("button", { name: "Отложить" }));
    expect(onSnoozeReminder).toHaveBeenCalledWith(categoryReminder);
    expect(onOpenReminder).not.toHaveBeenCalled();
  });

  it("renders in-progress check session section", () => {
    const checkSession: CheckSession = {
      id: "check-1",
      categoryId: "cat-1",
      status: "IN_PROGRESS",
      startedAt: "2026-09-01T00:00:00Z",
      completedAt: null,
      category,
      items: [
        { id: "ci-1", sessionId: "check-1", itemId: "item-1", sortOrder: 0, selectedStatus: null, checkedAt: null, item: itemNeedBuy }
      ]
    };
    render(<HomeView {...createProps({ checkSession })} />);
    expect(screen.getByRole("heading", { name: "Проверка" })).toBeInTheDocument();
    expect(screen.getByText("1 из 1")).toBeInTheDocument();
  });
});
