import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import { PanelHeader } from "./PanelHeader";

describe("PanelHeader", () => {
  it("renders label and progress", () => {
    render(
      <PanelHeader
        done={1}
        total={6}
        onArchive={vi.fn()}
        onCheck={vi.fn()}
      />
    );
    expect(screen.getByText("Купить · 1 из 6")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "1");
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuemax", "6");
  });

  it("calls onArchive when archive link is pressed", () => {
    const handleArchive = vi.fn();
    render(
      <PanelHeader
        done={1}
        total={6}
        onArchive={handleArchive}
        onCheck={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Архив" }));
    expect(handleArchive).toHaveBeenCalledOnce();
  });

  it("calls onCheck when check button is pressed", () => {
    const handleCheck = vi.fn();
    render(
      <PanelHeader
        done={1}
        total={6}
        onArchive={vi.fn()}
        onCheck={handleCheck}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Проверить" }));
    expect(handleCheck).toHaveBeenCalledOnce();
  });

  it("disables actions when disabled is true", () => {
    render(
      <PanelHeader
        done={0}
        total={0}
        onArchive={vi.fn()}
        onCheck={vi.fn()}
        disabled
      />
    );
    expect(screen.getByRole("button", { name: "Архив" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Проверить" })).toBeDisabled();
  });
});
