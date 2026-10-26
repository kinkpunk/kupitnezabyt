import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TOAST_DURATION_MS, ToastNotice } from "./ToastNotice";

describe("ToastNotice", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders nothing without a message", () => {
    const { container } = render(<ToastNotice message={null} onClose={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("auto-dismisses after the toast duration", () => {
    const handleClose = vi.fn();
    render(<ToastNotice message="Кофе — куплено" onClose={handleClose} />);

    vi.advanceTimersByTime(TOAST_DURATION_MS);
    expect(handleClose).toHaveBeenCalledOnce();
  });

  it("does not auto-dismiss before the toast duration", () => {
    const handleClose = vi.fn();
    render(<ToastNotice message="Кофе — куплено" onClose={handleClose} />);

    vi.advanceTimersByTime(TOAST_DURATION_MS - 1);
    expect(handleClose).not.toHaveBeenCalled();
  });

  it("restarts the auto-dismiss timer when the message changes", () => {
    const handleClose = vi.fn();
    const { rerender } = render(<ToastNotice message="Первое" onClose={handleClose} />);

    vi.advanceTimersByTime(TOAST_DURATION_MS - 1000);
    rerender(<ToastNotice message="Второе" onClose={handleClose} />);

    vi.advanceTimersByTime(TOAST_DURATION_MS - 1000);
    expect(handleClose).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1000);
    expect(handleClose).toHaveBeenCalledOnce();
  });

  it("cancels auto-dismiss on unmount", () => {
    const handleClose = vi.fn();
    const { unmount } = render(<ToastNotice message="Кофе — куплено" onClose={handleClose} />);

    unmount();
    vi.advanceTimersByTime(TOAST_DURATION_MS);
    expect(handleClose).not.toHaveBeenCalled();
  });

  it("closes immediately via the close button", () => {
    const handleClose = vi.fn();
    const { rerender } = render(<ToastNotice message="Кофе — куплено" onClose={handleClose} />);

    fireEvent.click(screen.getByRole("button", { name: "Закрыть" }));
    expect(handleClose).toHaveBeenCalledOnce();

    rerender(<ToastNotice message={null} onClose={handleClose} />);
    vi.advanceTimersByTime(TOAST_DURATION_MS * 2);
    expect(handleClose).toHaveBeenCalledOnce();
  });

  it("keeps a stable timer across re-renders with a new onClose reference", () => {
    const latestClose = vi.fn();
    const { rerender } = render(<ToastNotice message="Кофе — куплено" onClose={vi.fn()} />);

    for (let index = 0; index < 5; index += 1) {
      rerender(<ToastNotice message="Кофе — куплено" onClose={latestClose} />);
    }

    vi.advanceTimersByTime(TOAST_DURATION_MS);
    expect(latestClose).toHaveBeenCalledOnce();
  });

  it("renders the action button and runs it before closing", () => {
    const handleAction = vi.fn();
    const handleClose = vi.fn();
    const { rerender } = render(
      <ToastNotice
        message="Кофе — куплено"
        actionLabel="Отменить"
        onAction={handleAction}
        onClose={handleClose}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Отменить" }));
    expect(handleAction).toHaveBeenCalledOnce();
    expect(handleClose).toHaveBeenCalledOnce();

    rerender(
      <ToastNotice
        message={null}
        actionLabel="Отменить"
        onAction={handleAction}
        onClose={handleClose}
      />
    );
    vi.advanceTimersByTime(TOAST_DURATION_MS * 2);
    expect(handleClose).toHaveBeenCalledOnce();
  });

  it("does not render the action button without an onAction handler", () => {
    render(<ToastNotice message="Кофе — куплено" actionLabel="Отменить" onClose={vi.fn()} />);

    expect(screen.queryByRole("button", { name: "Отменить" })).not.toBeInTheDocument();
  });
});
