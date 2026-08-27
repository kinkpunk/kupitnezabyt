import { PackageSearch } from "lucide-react";
import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import { EmptyState } from "./EmptyState";

describe("EmptyState", () => {
  it("renders title and description", () => {
    render(<EmptyState title="Ничего не найдено" description="Попробуйте изменить запрос" />);
    expect(screen.getByText("Ничего не найдено")).toBeInTheDocument();
    expect(screen.getByText("Попробуйте изменить запрос")).toBeInTheDocument();
  });

  it("renders icon when provided", () => {
    render(<EmptyState title="Пусто" icon={PackageSearch} />);
    expect(document.querySelector("svg")).toBeInTheDocument();
  });

  it("renders action button and calls handler", () => {
    const handleAction = vi.fn();
    render(<EmptyState title="Пусто" actionLabel="Добавить" onAction={handleAction} />);
    const button = screen.getByRole("button", { name: "Добавить" });
    expect(button).toBeInTheDocument();
    fireEvent.click(button);
    expect(handleAction).toHaveBeenCalledOnce();
  });

  it("does not render action button without label or handler", () => {
    render(<EmptyState title="Пусто" />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
