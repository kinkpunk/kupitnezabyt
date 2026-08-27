import { Plus } from "lucide-react";
import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it } from "vitest";

import { Button } from "../ui/Button";
import { SectionHeader } from "./SectionHeader";

describe("SectionHeader", () => {
  it("renders title and subtitle", () => {
    render(<SectionHeader title="Категории" subtitle="5 активных" />);
    expect(screen.getByRole("heading", { name: "Категории" })).toBeInTheDocument();
    expect(screen.getByText("5 активных")).toBeInTheDocument();
  });

  it("renders actions on the right", () => {
    render(
      <SectionHeader
        title="Товары"
        actions={
          <Button aria-label="Добавить" variant="icon">
            <Plus aria-hidden="true" size={18} />
          </Button>
        }
      />
    );
    expect(screen.getByRole("button", { name: "Добавить" })).toBeInTheDocument();
  });

  it("renders only title when subtitle and actions omitted", () => {
    render(<SectionHeader title="Просто заголовок" />);
    expect(screen.getByRole("heading", { name: "Просто заголовок" })).toBeInTheDocument();
    expect(screen.queryByText(/активных/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
