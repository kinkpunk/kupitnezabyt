import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import { BottomNav } from "./BottomNav";

describe("BottomNav", () => {
  it("renders three navigation items", () => {
    render(
      <BottomNav
        activeTab="home"
        showMenuSheet={false}
        onSelectTab={vi.fn()}
        onToggleMenu={vi.fn()}
      />
    );
    expect(screen.getByRole("button", { name: "Главная" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Категории" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Меню" })).toBeInTheDocument();
  });

  it("marks active tab", () => {
    render(
      <BottomNav
        activeTab="items"
        showMenuSheet={false}
        onSelectTab={vi.fn()}
        onToggleMenu={vi.fn()}
      />
    );
    expect(screen.getByRole("button", { name: "Категории" })).toHaveClass("active");
    expect(screen.getByRole("button", { name: "Главная" })).not.toHaveClass("active");
  });

  it("calls onSelectTab when a tab is pressed", () => {
    const handleSelect = vi.fn();
    render(
      <BottomNav
        activeTab="home"
        showMenuSheet={false}
        onSelectTab={handleSelect}
        onToggleMenu={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Категории" }));
    expect(handleSelect).toHaveBeenCalledWith("items");
  });

  it("marks menu as active when sheet is open", () => {
    render(
      <BottomNav
        activeTab="home"
        showMenuSheet
        onSelectTab={vi.fn()}
        onToggleMenu={vi.fn()}
      />
    );
    expect(screen.getByRole("button", { name: "Меню" })).toHaveClass("active");
  });

  it("calls onToggleMenu when menu button is pressed", () => {
    const handleToggle = vi.fn();
    render(
      <BottomNav
        activeTab="home"
        showMenuSheet={false}
        onSelectTab={vi.fn()}
        onToggleMenu={handleToggle}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Меню" }));
    expect(handleToggle).toHaveBeenCalledOnce();
  });
});
