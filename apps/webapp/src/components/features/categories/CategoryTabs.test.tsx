import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import { CategoryTabs } from "./CategoryTabs";

const categories = [
  { id: "1", name: "Еда", aggregateStatus: "OK" as const },
  { id: "2", name: "Дом", aggregateStatus: "ATTENTION" as const },
  { id: "3", name: "Аптека", aggregateStatus: "URGENT" as const }
];

describe("CategoryTabs", () => {
  it("renders category tabs", () => {
    render(
      <CategoryTabs
        categories={categories}
        selectedId="1"
        onSelect={vi.fn()}
      />
    );
    expect(screen.getByRole("tab", { name: "Еда" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Дом" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Аптека" })).toBeInTheDocument();
  });

  it("marks selected tab as active", () => {
    render(
      <CategoryTabs
        categories={categories}
        selectedId="2"
        onSelect={vi.fn()}
      />
    );
    expect(screen.getByRole("tab", { name: "Дом" })).toHaveClass(
      "ds-category-tab--active"
    );
    expect(screen.getByRole("tab", { name: "Еда" })).not.toHaveClass(
      "ds-category-tab--active"
    );
  });

  it("shows warning dot for categories that need attention", () => {
    render(
      <CategoryTabs
        categories={categories}
        selectedId="1"
        onSelect={vi.fn()}
      />
    );
    const foodTab = screen.getByRole("tab", { name: "Еда" });
    const homeTab = screen.getByRole("tab", { name: "Дом" });
    const pharmacyTab = screen.getByRole("tab", { name: "Аптека" });

    expect(foodTab.querySelector(".ds-category-tab__warning")).toBeNull();
    expect(homeTab.querySelector(".ds-category-tab__warning")).toBeInTheDocument();
    expect(pharmacyTab.querySelector(".ds-category-tab__warning")).toBeInTheDocument();
  });

  it("calls onSelect with category id", () => {
    const handleSelect = vi.fn();
    render(
      <CategoryTabs
        categories={categories}
        selectedId="1"
        onSelect={handleSelect}
      />
    );
    fireEvent.click(screen.getByRole("tab", { name: "Аптека" }));
    expect(handleSelect).toHaveBeenCalledWith("3");
  });

  it("returns null when categories list is empty", () => {
    const { container } = render(
      <CategoryTabs categories={[]} selectedId={null} onSelect={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });
});
