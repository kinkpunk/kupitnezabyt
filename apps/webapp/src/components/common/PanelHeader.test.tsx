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
    onArchive: vi.fn(),
    onCheck: vi.fn(),
    ...overrides
  };
}

describe("PanelHeader", () => {
  it("renders need-buy label and progress", () => {
    render(<PanelHeader {...createProps()} />);
    expect(screen.getByText("Купить · 1 из 6")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "4");
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuemax", "6");
  });

  it("renders low label when nothing needs to be bought", () => {
    render(<PanelHeader {...createProps({ needBuy: 0 })} />);
    expect(screen.getByText("Мало · 1 из 6")).toBeInTheDocument();
  });

  it("renders OK label when everything is in stock", () => {
    render(<PanelHeader {...createProps({ needBuy: 0, low: 0, inStock: 6 })} />);
    expect(screen.getByText("ОК")).toBeInTheDocument();
  });

  it("renders empty label for an empty category", () => {
    render(<PanelHeader {...createProps({ total: 0, inStock: 0, needBuy: 0, low: 0 })} />);
    expect(screen.getByText("Пусто")).toBeInTheDocument();
  });

  it("calls onArchive when archive link is pressed", () => {
    const handleArchive = vi.fn();
    render(<PanelHeader {...createProps({ onArchive: handleArchive })} />);
    fireEvent.click(screen.getByRole("button", { name: "Архив" }));
    expect(handleArchive).toHaveBeenCalledOnce();
  });

  it("calls onCheck when check button is pressed", () => {
    const handleCheck = vi.fn();
    render(<PanelHeader {...createProps({ onCheck: handleCheck })} />);
    fireEvent.click(screen.getByRole("button", { name: "Проверить" }));
    expect(handleCheck).toHaveBeenCalledOnce();
  });

  it("disables actions when disabled is true", () => {
    render(<PanelHeader {...createProps({ total: 0, inStock: 0, needBuy: 0, low: 0, disabled: true })} />);
    expect(screen.getByRole("button", { name: "Архив" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Проверить" })).toBeDisabled();
  });
});
