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

  it("announces the next status in the cycle", () => {
    render(<StatusChip status="bad" onCycle={vi.fn()} />);
    expect(screen.getByRole("button")).toHaveAccessibleName("Статус: Нет. Следующий: Есть.");
  });

  it("opens a direct-selection menu from the chevron toggle", () => {
    const handleSelect = vi.fn();
    render(<StatusChip status="warn" onCycle={vi.fn()} onSelect={handleSelect} />);

    fireEvent.click(screen.getByRole("button", { name: "Выбрать статус" }));

    const options = screen.getAllByRole("menuitemradio");
    expect(options).toHaveLength(3);
    expect(options.map((option) => option.textContent)).toEqual(["Есть", "Мало", "Нет"]);
    expect(screen.getByRole("menuitemradio", { name: "Мало" })).toHaveAttribute(
      "aria-checked",
      "true"
    );

    fireEvent.click(screen.getByRole("menuitemradio", { name: "Нет" }));
    expect(handleSelect).toHaveBeenCalledWith("bad");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("keeps the body click cycling in split mode", () => {
    const handleCycle = vi.fn();
    render(<StatusChip status="ok" onCycle={handleCycle} onSelect={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Статус: Есть/ }));
    expect(handleCycle).toHaveBeenCalledOnce();
  });

  it("closes the menu on Escape", () => {
    render(<StatusChip status="ok" onCycle={vi.fn()} onSelect={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Выбрать статус" }));
    expect(screen.getByRole("menu")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("closes the menu on an outside pointer down", () => {
    render(
      <div>
        <StatusChip status="ok" onCycle={vi.fn()} onSelect={vi.fn()} />
        <button type="button">Снаружи</button>
      </div>
    );
    fireEvent.click(screen.getByRole("button", { name: "Выбрать статус" }));
    expect(screen.getByRole("menu")).toBeInTheDocument();
    fireEvent.pointerDown(screen.getByRole("button", { name: "Снаружи" }));
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
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
