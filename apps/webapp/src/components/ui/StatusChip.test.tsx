import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import { StatusChip } from "./StatusChip";

describe("StatusChip", () => {
  it.each([
    ["ok", "Есть"],
    ["warn", "Мало"],
    ["bad", "Нет"]
  ] as const)("renders '%s' status with label '%s'", (status, label) => {
    render(<StatusChip status={status} onCycle={vi.fn()} />);
    const button = screen.getByRole("button", { name: new RegExp(label) });
    expect(button).toHaveTextContent(label);
    expect(button).toHaveClass(`ds-status-chip--${status}`);
  });

  it("calls onCycle when clicked", () => {
    const handleCycle = vi.fn();
    render(<StatusChip status="ok" onCycle={handleCycle} />);
    fireEvent.click(screen.getByRole("button"));
    expect(handleCycle).toHaveBeenCalledOnce();
  });

  it("is disabled when disabled prop is true", () => {
    render(<StatusChip status="ok" onCycle={vi.fn()} disabled />);
    expect(screen.getByRole("button")).toBeDisabled();
  });
});
