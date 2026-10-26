import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import { ProductRow, ProductRowMoreButton } from "./ProductRow";

describe("ProductRow", () => {
  it("renders title and subtitle", () => {
    render(
      <ProductRow
        title="Рикотта"
        subtitle="Обновлено вчера"
        onStatusClick={vi.fn()}
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
        title="Кофе"
        status={status}
        onStatusClick={vi.fn()}
      />
    );
    expect(screen.getByRole("button", { name: new RegExp(label) })).toBeInTheDocument();
  });

  it("renders paused status as a static chip", () => {
    render(
      <ProductRow
        title="Чай"
        status="paused"
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
        title="Молоко"
        status="ok"
        onStatusClick={handleStatusClick}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /Есть/ }));
    expect(handleStatusClick).toHaveBeenCalledOnce();
  });

  it("calls onClick when title is pressed", () => {
    const handleClick = vi.fn();
    render(
      <ProductRow
        title="Сыр"
        onClick={handleClick}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Сыр" }));
    expect(handleClick).toHaveBeenCalledOnce();
  });

  it("keeps the row wrapper free of button semantics and nesting", () => {
    render(
      <ProductRow
        title="Сыр"
        status="ok"
        onStatusClick={vi.fn()}
        onClick={vi.fn()}
      />
    );
    const row = document.querySelector(".ds-product-row");
    expect(row).not.toBeNull();
    expect(row).not.toHaveAttribute("role", "button");
    expect(row).not.toHaveAttribute("tabindex");
    expect(row?.querySelector(".ds-product-row__title")?.tagName).toBe("BUTTON");
  });

  it("renders title as plain text when onClick is not provided", () => {
    render(<ProductRow title="Сыр" />);
    expect(screen.queryByRole("button", { name: "Сыр" })).not.toBeInTheDocument();
    expect(screen.getByText("Сыр")).toBeInTheDocument();
  });

  it("renders custom actions", () => {
    render(
      <ProductRow
        title="Хлеб"
        actions={<button type="button">Куплено</button>}
      />
    );
    expect(screen.getByRole("button", { name: "Куплено" })).toBeInTheDocument();
  });

  it("renders meta content", () => {
    render(
      <ProductRow
        title="Масло"
        meta={<span>Категория</span>}
      />
    );
    expect(screen.getByText("Категория")).toBeInTheDocument();
  });

  it("renders reorder handle when requested", () => {
    render(
      <ProductRow
        title="Сахар"
        reorderHandle
      />
    );
    expect(document.querySelector(".ds-product-row__reorder")).toBeInTheDocument();
  });
});

describe("ProductRowMoreButton", () => {
  it("calls onClick when pressed", () => {
    const handleClick = vi.fn();
    render(<ProductRowMoreButton onClick={handleClick} />);
    fireEvent.click(screen.getByRole("button", { name: "Ещё" }));
    expect(handleClick).toHaveBeenCalledOnce();
  });
});
