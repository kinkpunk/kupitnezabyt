import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import { AppHeader } from "./AppHeader";

function renderHeader(overrides: Partial<React.ComponentProps<typeof AppHeader>> = {}) {
  return render(
    <AppHeader
      menuOpen={false}
      menuActive={false}
      onMenuClick={vi.fn()}
      {...overrides}
    />
  );
}

describe("AppHeader", () => {
  it("renders brand logo and wordmark", () => {
    renderHeader();
    expect(screen.getByAltText("")).toHaveClass("ds-app-header__logo");
    expect(screen.getByText("kupit")).toBeInTheDocument();
    expect(screen.getByText("nezabyt")).toBeInTheDocument();
  });

  it("renders menu button without notifications bell", () => {
    renderHeader();
    expect(screen.getByRole("button", { name: "Меню" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Уведомления" })).not.toBeInTheDocument();
  });

  it("calls onMenuClick when menu is pressed", () => {
    const handleClick = vi.fn();
    renderHeader({ onMenuClick: handleClick });
    fireEvent.click(screen.getByRole("button", { name: "Меню" }));
    expect(handleClick).toHaveBeenCalledOnce();
  });

  it("marks menu as expanded only when the sheet is open", () => {
    renderHeader({ menuOpen: true, menuActive: true });
    expect(screen.getByRole("button", { name: "Меню" })).toHaveAttribute(
      "aria-expanded",
      "true"
    );
  });

  it("marks menu as active when a menu section is open", () => {
    renderHeader({ menuActive: true });
    expect(screen.getByRole("button", { name: "Меню" })).toHaveClass("active");
    expect(screen.getByRole("button", { name: "Меню" })).toHaveAttribute(
      "aria-expanded",
      "false"
    );
  });

  it("does not mark menu as active by default", () => {
    renderHeader();
    expect(screen.getByRole("button", { name: "Меню" })).not.toHaveClass("active");
  });
});
