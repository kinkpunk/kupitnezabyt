import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import { ProductRow } from "./ProductRow";

describe("ProductRow", () => {
  it("renders name and subtitle", () => {
    render(
      <ProductRow
        name="Рикотта"
        subtitle="Обновлено вчера"
        status="warn"
        onStatusClick={vi.fn()}
        onMoreClick={vi.fn()}
      />
    );
    expect(screen.getByText("Рикотта")).toBeInTheDocument();
    expect(screen.getByText("Обновлено вчера")).toBeInTheDocument();
  });

  it.each([
    ["ok", "Есть"],
    ["warn", "Мало"],
    ["bad", "Нет"]
  ] as const)("renders status chip for '%s'", (status, label) => {
    render(
      <ProductRow
        name="Кофе"
        subtitle=""
        status={status}
        onStatusClick={vi.fn()}
        onMoreClick={vi.fn()}
      />
    );
    expect(screen.getByRole("button", { name: new RegExp(label) })).toBeInTheDocument();
  });

  it("renders paused status as a static chip", () => {
    render(
      <ProductRow
        name="Чай"
        subtitle=""
        status="paused"
        onStatusClick={vi.fn()}
        onMoreClick={vi.fn()}
      />
    );
    const chip = screen.getByText("Пауза").closest(".ds-status-chip");
    expect(chip).toHaveClass("ds-status-chip--paused");
    expect(chip).not.toHaveAttribute("role", "button");
  });

  it("calls onStatusClick when status chip is pressed", () => {
    const handleStatusClick = vi.fn();
    render(
      <ProductRow
        name="Молоко"
        subtitle=""
        status="ok"
        onStatusClick={handleStatusClick}
        onMoreClick={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /Есть/ }));
    expect(handleStatusClick).toHaveBeenCalledOnce();
  });

  it("calls onMoreClick when more button is pressed", () => {
    const handleMoreClick = vi.fn();
    render(
      <ProductRow
        name="Сыр"
        subtitle=""
        status="ok"
        onStatusClick={vi.fn()}
        onMoreClick={handleMoreClick}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Действия" }));
    expect(handleMoreClick).toHaveBeenCalledOnce();
  });
});
