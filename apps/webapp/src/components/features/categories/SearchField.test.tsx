import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import { SearchField } from "./SearchField";

describe("SearchField", () => {
  it("renders with default placeholder", () => {
    render(<SearchField value="" onChange={vi.fn()} />);
    expect(
      screen.getByPlaceholderText("Найти товар или категорию")
    ).toBeInTheDocument();
  });

  it("renders provided value", () => {
    render(<SearchField value="молоко" onChange={vi.fn()} />);
    expect(screen.getByDisplayValue("молоко")).toBeInTheDocument();
  });

  it("forwards changes", () => {
    const handleChange = vi.fn();
    render(<SearchField value="" onChange={handleChange} />);
    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "кофе" }
    });
    expect(handleChange).toHaveBeenCalledWith("кофе");
  });

  it("uses custom aria-label", () => {
    render(<SearchField value="" onChange={vi.fn()} label="Глобальный поиск" />);
    expect(screen.getByRole("searchbox", { name: "Глобальный поиск" })).toBeInTheDocument();
  });
});
