import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import type { WorkspaceSummary } from "../lib/types";
import { MenuSheet } from "./MenuSheet";

const workspaces: WorkspaceSummary[] = [
  { id: "ws-1", name: "Дом", ownerId: "u1", role: "OWNER", joinedAt: null, memberCount: 1, owner: { id: "u1", email: null, displayName: null, firstName: null } }
];

function createProps(overrides: Partial<React.ComponentProps<typeof MenuSheet>> = {}) {
  const { activeWorkspace, ...rest } = overrides;
  return {
    show: true,
    activeWorkspace: (activeWorkspace !== undefined ? activeWorkspace : workspaces[0]) as WorkspaceSummary | null,
    workspaces,
    showWorkspaceSwitcher: true,
    activeTab: "shopping" as const,
    onClose: vi.fn(),
    onSelectTab: vi.fn(),
    onSelectWorkspace: vi.fn().mockResolvedValue(undefined),
    ...rest
  };
}

describe("MenuSheet", () => {
  it("does not render when show is false", () => {
    render(<MenuSheet {...createProps({ show: false })} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders workspace switcher and tabs", () => {
    render(<MenuSheet {...createProps()} />);
    expect(screen.getByLabelText("Активный список")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Покупки" })).toHaveClass("ds-bottom-sheet__action--active");
    expect(screen.getByRole("button", { name: "Наборы" })).toBeInTheDocument();
  });

  it("calls onSelectTab when tab is clicked", () => {
    const onSelectTab = vi.fn();
    render(<MenuSheet {...createProps({ onSelectTab })} />);
    fireEvent.click(screen.getByRole("button", { name: "Настройки" }));
    expect(onSelectTab).toHaveBeenCalledWith("settings");
  });

  it("calls onSelectWorkspace when workspace changes", () => {
    const onSelectWorkspace = vi.fn().mockResolvedValue(undefined);
    render(<MenuSheet {...createProps({ onSelectWorkspace })} />);
    fireEvent.change(screen.getByLabelText("Активный список"), { target: { value: "ws-1" } });
    expect(onSelectWorkspace).toHaveBeenCalledWith("ws-1");
  });

  it("does not render workspace switcher when disabled", () => {
    render(<MenuSheet {...createProps({ showWorkspaceSwitcher: false })} />);
    expect(screen.queryByLabelText("Активный список")).not.toBeInTheDocument();
  });
});
