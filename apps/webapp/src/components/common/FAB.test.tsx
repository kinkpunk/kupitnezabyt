import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import { FAB } from "./FAB";

describe("FAB", () => {
  it("renders add button with default label", () => {
    render(<FAB onClick={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Добавить" })).toBeInTheDocument();
  });

  it("uses custom label", () => {
    render(<FAB label="Новый товар" onClick={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Новый товар" })).toBeInTheDocument();
  });

  it("calls onClick when pressed", () => {
    const handleClick = vi.fn();
    render(<FAB onClick={handleClick} />);
    fireEvent.click(screen.getByRole("button"));
    expect(handleClick).toHaveBeenCalledOnce();
  });
});
