import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it } from "vitest";

import { OfflineBanner } from "./OfflineBanner";

describe("OfflineBanner", () => {
  it("renders an accessible status message", () => {
    render(<OfflineBanner />);

    expect(screen.getByRole("status")).toHaveTextContent("Нет сети");
  });
});
