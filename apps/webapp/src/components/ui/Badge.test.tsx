import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it } from "vitest";

import { Badge } from "./Badge";

describe("Badge", () => {
  it("renders count", () => {
    render(<Badge count={4} />);
    expect(screen.getByText("4")).toBeInTheDocument();
  });

  it("renders nothing when count is zero", () => {
    const { container } = render(<Badge count={0} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders 99+ for large counts", () => {
    render(<Badge count={150} />);
    expect(screen.getByText("99+")).toBeInTheDocument();
  });
});
