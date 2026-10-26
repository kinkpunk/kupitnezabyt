import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import { BottomSheet } from "./BottomSheet";

describe("BottomSheet", () => {
  it("renders nothing when show is false", () => {
    const { container } = render(
      <BottomSheet show={false} onClose={vi.fn()}>
        <p>Содержимое</p>
      </BottomSheet>
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders sheet with title and children when show is true", () => {
    render(
      <BottomSheet show title="Действия" onClose={vi.fn()}>
        <button type="button">Удалить</button>
      </BottomSheet>
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Действия")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Удалить" })).toBeInTheDocument();
  });

  it("keeps role dialog with aria-modal on the sheet, not on the overlay", () => {
    render(
      <BottomSheet show title="Действия" onClose={vi.fn()}>
        <p>Содержимое</p>
      </BottomSheet>
    );
    const dialog = screen.getByRole("dialog", { name: "Действия" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(screen.getByRole("presentation")).not.toHaveAttribute("aria-modal");
  });

  it("moves focus to the first focusable element when opened", () => {
    render(
      <BottomSheet show title="Действия" onClose={vi.fn()}>
        <button type="button">Удалить</button>
      </BottomSheet>
    );
    expect(screen.getByRole("button", { name: "Закрыть" })).toHaveFocus();
  });

  it("focuses the sheet itself when it has no focusable content", () => {
    render(
      <BottomSheet show onClose={vi.fn()}>
        <p>Содержимое</p>
      </BottomSheet>
    );
    expect(screen.getByRole("dialog")).toHaveFocus();
  });

  it("wraps Tab focus inside the sheet", () => {
    render(
      <BottomSheet show title="Действия" onClose={vi.fn()}>
        <button type="button">Первый</button>
        <button type="button">Второй</button>
      </BottomSheet>
    );
    const closeButton = screen.getByRole("button", { name: "Закрыть" });
    const lastButton = screen.getByRole("button", { name: "Второй" });

    lastButton.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(closeButton).toHaveFocus();

    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(lastButton).toHaveFocus();
  });

  it("returns focus to the trigger element when closed", () => {
    function Wrapper() {
      const [show, setShow] = React.useState(false);
      return (
        <>
          <button type="button" onClick={() => setShow(true)}>
            Открыть
          </button>
          <BottomSheet show={show} title="Действия" onClose={() => setShow(false)}>
            <p>Содержимое</p>
          </BottomSheet>
        </>
      );
    }
    render(<Wrapper />);
    const trigger = screen.getByRole("button", { name: "Открыть" });
    trigger.focus();
    fireEvent.click(trigger);
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("locks body scroll while open and restores it on close", () => {
    const { unmount } = render(
      <BottomSheet show title="Действия" onClose={vi.fn()}>
        <p>Содержимое</p>
      </BottomSheet>
    );
    expect(document.body.style.overflow).toBe("hidden");

    unmount();
    expect(document.body.style.overflow).toBe("");
  });

  it("does not steal focus from the input when the parent re-renders with a new onClose", () => {
    function Wrapper() {
      const [name, setName] = React.useState("");
      return (
        <>
          <BottomSheet show title="Новая категория" onClose={() => undefined}>
            <input
              aria-label="Название категории"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </BottomSheet>
        </>
      );
    }
    render(<Wrapper />);

    const input = screen.getByRole("textbox", { name: "Название категории" });
    input.focus();
    fireEvent.change(input, { target: { value: "К" } });
    fireEvent.change(input, { target: { value: "Ку" } });

    expect(input).toHaveFocus();
    expect(input).toHaveValue("Ку");
  });

  it("calls onClose when overlay is clicked", () => {
    const handleClose = vi.fn();
    render(
      <BottomSheet show onClose={handleClose}>
        <p>Содержимое</p>
      </BottomSheet>
    );
    fireEvent.click(screen.getByRole("presentation"));
    expect(handleClose).toHaveBeenCalledOnce();
  });

  it("calls onClose when close button is clicked", () => {
    const handleClose = vi.fn();
    render(
      <BottomSheet show title="Действия" onClose={handleClose}>
        <p>Содержимое</p>
      </BottomSheet>
    );
    fireEvent.click(screen.getByRole("button", { name: "Закрыть" }));
    expect(handleClose).toHaveBeenCalledOnce();
  });

  it("calls onClose when Escape is pressed", () => {
    const handleClose = vi.fn();
    render(
      <BottomSheet show title="Действия" onClose={handleClose}>
        <p>Содержимое</p>
      </BottomSheet>
    );
    fireEvent.keyDown(document, { key: "Escape" });
    expect(handleClose).toHaveBeenCalledOnce();
  });

  it("does not listen for Escape when hidden", () => {
    const handleClose = vi.fn();
    render(
      <BottomSheet show={false} onClose={handleClose}>
        <p>Содержимое</p>
      </BottomSheet>
    );
    fireEvent.keyDown(document, { key: "Escape" });
    expect(handleClose).not.toHaveBeenCalled();
  });

  it("does not close when sheet content is clicked", () => {
    const handleClose = vi.fn();
    render(
      <BottomSheet show title="Действия" onClose={handleClose}>
        <button type="button">Внутри</button>
      </BottomSheet>
    );
    fireEvent.click(screen.getByRole("button", { name: "Внутри" }));
    expect(handleClose).not.toHaveBeenCalled();
  });
});
