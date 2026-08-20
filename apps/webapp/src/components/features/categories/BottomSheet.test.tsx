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
