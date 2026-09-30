import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import { ChipTabs } from "./ChipTabs";

const items = [
  { id: "a", label: "Еда" },
  { id: "b", label: "Аптека", warning: true },
  { id: "c", label: "Дом" }
];

describe("ChipTabs", () => {
  it("renders nothing when items are empty", () => {
    const { container } = render(
      <ChipTabs items={[]} selectedId={null} onSelect={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders tabs for each item", () => {
    render(<ChipTabs items={items} selectedId="a" onSelect={vi.fn()} />);
    expect(screen.getByRole("tab", { name: "Еда" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Аптека" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Дом" })).toBeInTheDocument();
  });

  it("marks selected tab", () => {
    render(<ChipTabs items={items} selectedId="b" onSelect={vi.fn()} />);
    expect(screen.getByRole("tab", { name: "Аптека" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Еда" })).toHaveAttribute("aria-selected", "false");
  });

  it("calls onSelect when tab is pressed", () => {
    const handleSelect = vi.fn();
    render(<ChipTabs items={items} selectedId="a" onSelect={handleSelect} />);
    fireEvent.click(screen.getByRole("tab", { name: "Дом" }));
    expect(handleSelect).toHaveBeenCalledWith("c");
  });

  it("shows warning dot for items with warning", () => {
    render(<ChipTabs items={items} selectedId="a" onSelect={vi.fn()} />);
    const tab = screen.getByRole("tab", { name: "Аптека" });
    expect(tab.querySelector(".ds-category-tab__warning")).toBeInTheDocument();
  });

  it("renders trailing action after tabs", () => {
    render(
      <ChipTabs
        items={items}
        selectedId="a"
        trailing={<button type="button">Добавить</button>}
        onSelect={vi.fn()}
      />
    );
    const tablist = screen.getByRole("tablist");
    expect(tablist.querySelector(".ds-category-tabs__trailing")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Добавить" })).toBeInTheDocument();
  });

  it("renders trailing action when items are empty", () => {
    render(
      <ChipTabs
        items={[]}
        selectedId={null}
        trailing={<button type="button">Добавить</button>}
        onSelect={vi.fn()}
      />
    );
    expect(screen.getByRole("button", { name: "Добавить" })).toBeInTheDocument();
  });

  it("renders empty state when provided and items are empty", () => {
    render(
      <ChipTabs items={[]} selectedId={null} onSelect={vi.fn()} emptyState={<p>Нет табов</p>} />
    );
    expect(screen.getByText("Нет табов")).toBeInTheDocument();
  });

  it("shows no edge fades when all tabs fit", () => {
    const { container } = render(<ChipTabs items={items} selectedId="a" onSelect={vi.fn()} />);
    const wrap = container.querySelector(".ds-category-tabs-wrap");
    expect(wrap).not.toBeNull();
    expect(wrap).not.toHaveClass("ds-category-tabs-wrap--start");
    expect(wrap).not.toHaveClass("ds-category-tabs-wrap--end");
  });

  it("shows end fade when tabs are hidden past the right edge", () => {
    const { container } = render(<ChipTabs items={items} selectedId="a" onSelect={vi.fn()} />);
    const wrap = container.querySelector(".ds-category-tabs-wrap");
    const tablist = screen.getByRole("tablist");
    Object.defineProperty(tablist, "scrollWidth", { value: 500, configurable: true });
    Object.defineProperty(tablist, "clientWidth", { value: 200, configurable: true });
    Object.defineProperty(tablist, "scrollLeft", { value: 0, configurable: true });
    fireEvent.scroll(tablist);
    expect(wrap).toHaveClass("ds-category-tabs-wrap--end");
    expect(wrap).not.toHaveClass("ds-category-tabs-wrap--start");
  });

  it("hides end fade at the right edge and shows start fade when scrolled", () => {
    const { container } = render(<ChipTabs items={items} selectedId="a" onSelect={vi.fn()} />);
    const wrap = container.querySelector(".ds-category-tabs-wrap");
    const tablist = screen.getByRole("tablist");
    Object.defineProperty(tablist, "scrollWidth", { value: 500, configurable: true });
    Object.defineProperty(tablist, "clientWidth", { value: 200, configurable: true });
    Object.defineProperty(tablist, "scrollLeft", { value: 300, configurable: true });
    fireEvent.scroll(tablist);
    expect(wrap).not.toHaveClass("ds-category-tabs-wrap--end");
    expect(wrap).toHaveClass("ds-category-tabs-wrap--start");
  });
});
