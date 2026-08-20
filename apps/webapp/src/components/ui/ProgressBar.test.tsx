import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it } from "vitest";

import { ProgressBar } from "./ProgressBar";

describe("ProgressBar", () => {
  it("renders progressbar with correct aria values", () => {
    render(<ProgressBar done={1} total={6} />);
    const bar = screen.getByRole("progressbar");
    expect(bar).toHaveAttribute("aria-valuenow", "1");
    expect(bar).toHaveAttribute("aria-valuemax", "6");
  });

  it("calculates fill width as percentage", () => {
    render(<ProgressBar done={2} total={8} />);
    const fill = screen.getByRole("progressbar").firstChild as HTMLElement;
    expect(fill.style.width).toBe("25%");
  });

  it("caps done at total", () => {
    render(<ProgressBar done={10} total={6} />);
    const fill = screen.getByRole("progressbar").firstChild as HTMLElement;
    expect(fill.style.width).toBe("100%");
  });

  it("handles zero total", () => {
    render(<ProgressBar done={0} total={0} />);
    const fill = screen.getByRole("progressbar").firstChild as HTMLElement;
    expect(fill.style.width).toBe("0%");
  });
});
