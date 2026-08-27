import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import { Button } from "./Button";

describe("Button", () => {
  it("renders primary variant by default", () => {
    render(<Button>Primary</Button>);
    const button = screen.getByRole("button", { name: "Primary" });
    expect(button).toHaveClass("ds-button", "ds-button--primary");
  });

  it("renders ghost variant", () => {
    render(<Button variant="ghost">Ghost</Button>);
    const button = screen.getByRole("button", { name: "Ghost" });
    expect(button).toHaveClass("ds-button--ghost");
    expect(button).not.toHaveClass("ds-button--primary");
  });

  it("renders icon variant", () => {
    render(<Button variant="icon" aria-label="Icon button" />);
    const button = screen.getByRole("button", { name: "Icon button" });
    expect(button).toHaveClass("ds-button--icon");
  });

  it("supports compact size for primary variant", () => {
    render(<Button size="compact">Compact</Button>);
    const button = screen.getByRole("button", { name: "Compact" });
    expect(button).toHaveClass("ds-button--compact");
  });

  it("supports compact size for icon variant", () => {
    render(<Button variant="icon" size="compact" aria-label="Compact icon" />);
    const button = screen.getByRole("button", { name: "Compact icon" });
    expect(button).toHaveClass("ds-button--icon--small");
  });

  it("forwards click handler", () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click me</Button>);
    fireEvent.click(screen.getByRole("button", { name: "Click me" }));
    expect(handleClick).toHaveBeenCalledOnce();
  });
});
