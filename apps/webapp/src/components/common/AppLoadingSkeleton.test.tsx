import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it } from "vitest";

import { AppLoadingSkeleton } from "./AppLoadingSkeleton";

describe("AppLoadingSkeleton", () => {
  it("renders skeleton blocks and an accessible status message", () => {
    render(<AppLoadingSkeleton message="Загрузка..." />);

    expect(screen.getByRole("status")).toHaveTextContent("Загрузка...");
    expect(document.querySelector("main")?.getAttribute("aria-busy")).toBe("true");
    expect(document.querySelectorAll(".ds-skeleton").length).toBeGreaterThan(0);
  });

  it("uses a default status message", () => {
    render(<AppLoadingSkeleton />);

    expect(screen.getByRole("status")).toHaveTextContent("Загрузка...");
  });
});
