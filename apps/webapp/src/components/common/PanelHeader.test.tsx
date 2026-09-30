import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import { PanelHeader } from "./PanelHeader";

function createProps(overrides: Partial<React.ComponentProps<typeof PanelHeader>> = {}) {
  return {
    total: 6,
    inStock: 4,
    needBuy: 1,
    low: 1,
    filter: "all" as const,
    onFilterChange: vi.fn(),
    onArchive: vi.fn(),
    onCheck: vi.fn(),
    ...overrides
  };
}

function expandPanel() {
  fireEvent.click(screen.getByRole("button", { name: "Фильтры и действия" }));
}

describe("PanelHeader", () => {
  it("renders collapsed by default with a toggle button", () => {
    render(<PanelHeader {...createProps()} />);
    const toggle = screen.getByRole("button", { name: "Фильтры и действия" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("group", { name: "Фильтр по статусу" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Проверить" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Архив" })).not.toBeInTheDocument();
  });

  it("expands the panel on toggle click and collapses on second click", () => {
    render(<PanelHeader {...createProps()} />);
    const toggle = screen.getByRole("button", { name: "Фильтры и действия" });
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("group", { name: "Фильтр по статусу" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Проверить" })).toBeInTheDocument();
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("group", { name: "Фильтр по статусу" })).not.toBeInTheDocument();
  });

  it("shows a dot indicator on the toggle when a filter is active", () => {
    const { rerender } = render(<PanelHeader {...createProps()} />);
    expect(
      document.querySelector(".ds-panel-header__toggle-dot")
    ).not.toBeInTheDocument();
    rerender(<PanelHeader {...createProps({ filter: "need_buy" })} />);
    expect(document.querySelector(".ds-panel-header__toggle-dot")).toBeInTheDocument();
  });

  it("renders filter chips with counts for non-zero statuses", () => {
    render(<PanelHeader {...createProps()} />);
    expandPanel();
    expect(screen.getByRole("button", { name: /Все/ })).toHaveTextContent("6");
    expect(screen.getByRole("button", { name: /Есть/ })).toHaveTextContent("4");
    expect(screen.getByRole("button", { name: /Мало/ })).toHaveTextContent("1");
    expect(screen.getByRole("button", { name: /Нет/ })).toHaveTextContent("1");
  });

  it("hides chips with zero count", () => {
    render(<PanelHeader {...createProps({ needBuy: 0, low: 0, inStock: 6 })} />);
    expandPanel();
    expect(screen.getByRole("button", { name: /Все/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Есть/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Мало/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Нет/ })).not.toBeInTheDocument();
  });

  it("renders no filters for an empty category", () => {
    render(<PanelHeader {...createProps({ total: 0, inStock: 0, needBuy: 0, low: 0 })} />);
    expandPanel();
    expect(screen.queryByRole("group", { name: "Фильтр по статусу" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Архив" })).toBeInTheDocument();
  });

  it("marks the active filter with aria-pressed", () => {
    render(<PanelHeader {...createProps({ filter: "need_buy" })} />);
    expandPanel();
    expect(screen.getByRole("button", { name: /Нет/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /Все/ })).toHaveAttribute("aria-pressed", "false");
  });

  it("calls onFilterChange when a chip is pressed", () => {
    const handleFilterChange = vi.fn();
    render(<PanelHeader {...createProps({ onFilterChange: handleFilterChange })} />);
    expandPanel();
    fireEvent.click(screen.getByRole("button", { name: /Нет/ }));
    expect(handleFilterChange).toHaveBeenCalledWith("need_buy");
  });

  it("keeps the panel expanded after a filter change", () => {
    render(<PanelHeader {...createProps()} />);
    expandPanel();
    fireEvent.click(screen.getByRole("button", { name: /Нет/ }));
    expect(screen.getByRole("group", { name: "Фильтр по статусу" })).toBeInTheDocument();
  });

  it("collapses the panel and calls onArchive when archive link is pressed", () => {
    const handleArchive = vi.fn();
    render(<PanelHeader {...createProps({ onArchive: handleArchive })} />);
    expandPanel();
    const archiveButton = screen.getByRole("button", { name: "Архив" });
    expect(archiveButton).toHaveTextContent("В архив");
    fireEvent.click(archiveButton);
    expect(handleArchive).toHaveBeenCalledOnce();
    expect(screen.queryByRole("group", { name: "Фильтр по статусу" })).not.toBeInTheDocument();
  });

  it("collapses the panel and calls onCheck when check button is pressed", () => {
    const handleCheck = vi.fn();
    render(<PanelHeader {...createProps({ onCheck: handleCheck })} />);
    expandPanel();
    fireEvent.click(screen.getByRole("button", { name: "Проверить" }));
    expect(handleCheck).toHaveBeenCalledOnce();
    expect(screen.queryByRole("group", { name: "Фильтр по статусу" })).not.toBeInTheDocument();
  });

  it("disables actions when disabled is true", () => {
    render(
      <PanelHeader
        {...createProps({ total: 0, inStock: 0, needBuy: 0, low: 0, disabled: true })}
      />
    );
    expandPanel();
    expect(screen.getByRole("button", { name: "Архив" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Проверить" })).toBeDisabled();
  });
});
