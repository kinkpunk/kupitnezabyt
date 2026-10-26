import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PurchaseCheckbox } from "./PurchaseCheckbox";

describe("PurchaseCheckbox", () => {
  afterEach(() => {
    delete window.Telegram;
  });

  it("renders with label Куплено", () => {
    render(<PurchaseCheckbox onMark={vi.fn()} />);
    expect(screen.getByRole("checkbox", { name: "Куплено" })).toBeInTheDocument();
  });

  it("exposes checkbox semantics with aria-checked", () => {
    render(<PurchaseCheckbox onMark={vi.fn()} />);
    expect(screen.getByRole("checkbox", { name: "Куплено" })).toHaveAttribute(
      "aria-checked",
      "false"
    );
  });

  it("calls onMark on click", () => {
    const onMark = vi.fn();
    render(<PurchaseCheckbox onMark={onMark} />);
    fireEvent.click(screen.getByRole("checkbox", { name: "Куплено" }));
    expect(onMark).toHaveBeenCalledOnce();
  });

  it("does not call onMark while pending and shows pending label", () => {
    const onMark = vi.fn();
    render(<PurchaseCheckbox pending onMark={onMark} />);
    const button = screen.getByRole("checkbox", { name: "Отмечаем..." });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(onMark).not.toHaveBeenCalled();
  });

  it("stops click propagation", () => {
    const onParentClick = vi.fn();
    const { container } = render(
      <div onClick={onParentClick}>
        <PurchaseCheckbox onMark={vi.fn()} />
      </div>
    );
    fireEvent.click(container.querySelector("button") as HTMLButtonElement);
    expect(onParentClick).not.toHaveBeenCalled();
  });

  it("triggers Telegram haptic feedback on click when available", () => {
    const impactOccurred = vi.fn();
    window.Telegram = {
      WebApp: {
        HapticFeedback: {
          impactOccurred
        }
      }
    };
    render(<PurchaseCheckbox onMark={vi.fn()} />);
    fireEvent.click(screen.getByRole("checkbox", { name: "Куплено" }));
    expect(impactOccurred).toHaveBeenCalledWith("light");
  });

  it("works when Telegram WebApp is unavailable", () => {
    const onMark = vi.fn();
    render(<PurchaseCheckbox onMark={onMark} />);
    fireEvent.click(screen.getByRole("checkbox", { name: "Куплено" }));
    expect(onMark).toHaveBeenCalledOnce();
  });
});
