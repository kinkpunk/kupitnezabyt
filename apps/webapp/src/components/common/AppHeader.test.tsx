import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import { AppHeader } from "./AppHeader";

function renderHeader(overrides: Partial<React.ComponentProps<typeof AppHeader>> = {}) {
  return render(
    <AppHeader
      notificationCount={0}
      menuOpen={false}
      menuActive={false}
      onBellClick={vi.fn()}
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

  it("renders bell and menu buttons", () => {
    renderHeader();
    expect(screen.getByRole("button", { name: "Уведомления" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Меню" })).toBeInTheDocument();
  });

  it("shows notification badge when count is greater than zero", () => {
    renderHeader({ notificationCount: 3 });
    expect(screen.getByLabelText("3 уведомлений")).toHaveTextContent("3");
  });

  it("hides notification badge when count is zero", () => {
    renderHeader();
    expect(screen.queryByLabelText(/уведомлений/)).not.toBeInTheDocument();
  });

  it("calls onBellClick when bell is pressed", () => {
    const handleClick = vi.fn();
    renderHeader({ onBellClick: handleClick });
    fireEvent.click(screen.getByRole("button", { name: "Уведомления" }));
    expect(handleClick).toHaveBeenCalledOnce();
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
