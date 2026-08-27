import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import { ThemeSwitcher } from "./ThemeSwitcher";

describe("ThemeSwitcher", () => {
  it("renders three theme options", () => {
    render(<ThemeSwitcher theme="system" onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Как на устройстве" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Светлая" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Тёмная" })).toBeInTheDocument();
  });

  it("marks current theme as pressed", () => {
    render(<ThemeSwitcher theme="dark" onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Тёмная" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Светлая" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Как на устройстве" })).toHaveAttribute(
      "aria-pressed",
      "false"
    );
  });

  it("calls onChange with selected theme", () => {
    const handleChange = vi.fn();
    render(<ThemeSwitcher theme="system" onChange={handleChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Светлая" }));
    expect(handleChange).toHaveBeenCalledWith("light");
  });
});
