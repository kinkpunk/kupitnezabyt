import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import { BottomNav } from "./BottomNav";

describe("BottomNav", () => {
  it("renders four navigation items", () => {
    render(<BottomNav activeTab="home" onSelectTab={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Главная" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Категории" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Покупки" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Наборы" })).toBeInTheDocument();
  });

  it("does not render a menu button", () => {
    render(<BottomNav activeTab="home" onSelectTab={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Меню" })).not.toBeInTheDocument();
  });

  it("marks active tab", () => {
    render(<BottomNav activeTab="items" onSelectTab={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Категории" })).toHaveClass("active");
    expect(screen.getByRole("button", { name: "Главная" })).not.toHaveClass("active");
  });

  it("sets aria-current on the active tab", () => {
    render(<BottomNav activeTab="shopping" onSelectTab={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Покупки" })).toHaveAttribute(
      "aria-current",
      "page"
    );
  });

  it("calls onSelectTab with the tab id when a tab is pressed", () => {
    const handleSelect = vi.fn();
    render(<BottomNav activeTab="home" onSelectTab={handleSelect} />);
    fireEvent.click(screen.getByRole("button", { name: "Наборы" }));
    expect(handleSelect).toHaveBeenCalledWith("groups");
  });
});
