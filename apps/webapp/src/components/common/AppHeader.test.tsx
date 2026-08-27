import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import { AppHeader } from "./AppHeader";

describe("AppHeader", () => {
  it("renders brand logo and wordmark", () => {
    render(<AppHeader notificationCount={0} onBellClick={vi.fn()} />);
    expect(screen.getByAltText("")).toHaveClass("ds-app-header__logo");
    expect(screen.getByText("kupit")).toBeInTheDocument();
    expect(screen.getByText("nezabyt")).toBeInTheDocument();
  });

  it("renders bell button", () => {
    render(<AppHeader notificationCount={0} onBellClick={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Уведомления" })).toBeInTheDocument();
  });

  it("shows notification badge when count is greater than zero", () => {
    render(<AppHeader notificationCount={3} onBellClick={vi.fn()} />);
    expect(screen.getByLabelText("3 уведомлений")).toHaveTextContent("3");
  });

  it("hides notification badge when count is zero", () => {
    render(<AppHeader notificationCount={0} onBellClick={vi.fn()} />);
    expect(screen.queryByLabelText(/уведомлений/)).not.toBeInTheDocument();
  });

  it("calls onBellClick when bell is pressed", () => {
    const handleClick = vi.fn();
    render(<AppHeader notificationCount={0} onBellClick={handleClick} />);
    fireEvent.click(screen.getByRole("button", { name: "Уведомления" }));
    expect(handleClick).toHaveBeenCalledOnce();
  });
});
