import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import type { WorkspaceInvitation, WorkspaceMember, WorkspaceSummary } from "../../lib/types";
import { SettingsView } from "./SettingsView";

const activeWorkspace: WorkspaceSummary = {
  id: "ws-1",
  name: "Мой список",
  ownerId: "u1",
  role: "OWNER",
  joinedAt: "2026-09-01T00:00:00Z",
  memberCount: 1,
  owner: { id: "u1", email: "a@example.com", displayName: "User", firstName: "User" }
};

function createProps(overrides: Partial<React.ComponentProps<typeof SettingsView>> = {}) {
  return {
    activeWorkspace,
    canManageActiveWorkspace: true,
    workspaceMessage: null,
    workspaceInviteEmail: "",
    setWorkspaceInviteEmail: vi.fn(),
    workspaceAction: null,
    devInvitationLink: null,
    isLoadingWorkspaceAccess: false,
    workspaceLoadFailed: false,
    workspaceMembers: [] as WorkspaceMember[],
    workspaceInvitations: [] as WorkspaceInvitation[],
    theme: "system" as const,
    onThemeChange: vi.fn(),
    onCreateWorkspaceInvitation: vi.fn().mockResolvedValue(undefined),
    onRevokeWorkspaceInvitation: vi.fn().mockResolvedValue(undefined),
    onRemoveWorkspaceMember: vi.fn().mockResolvedValue(undefined),
    onTransferWorkspaceOwnership: vi.fn().mockResolvedValue(undefined),
    onRetryWorkspaceLoad: vi.fn().mockResolvedValue(undefined),
    onExportUserData: vi.fn().mockResolvedValue(undefined),
    onDeleteAccount: vi.fn().mockResolvedValue(undefined),
    onSignOut: vi.fn(),
    setError: vi.fn(),
    ...overrides
  };
}

describe("SettingsView", () => {
  it("renders settings sections", () => {
    render(<SettingsView {...createProps()} />);
    expect(screen.getByRole("group", { name: "Тема оформления" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Как на устройстве" })).toHaveAttribute("aria-pressed", "true");
  });

  it("calls onThemeChange when theme option is clicked", () => {
    const onThemeChange = vi.fn();
    render(<SettingsView {...createProps({ onThemeChange })} />);
    fireEvent.click(screen.getByRole("button", { name: "Тёмная" }));
    expect(onThemeChange).toHaveBeenCalledWith("dark");
  });

  it("renders workspace panel with active workspace", () => {
    render(<SettingsView {...createProps()} />);
    expect(screen.getByRole("heading", { name: "Поделиться списком" })).toBeInTheDocument();
    expect(screen.getByText(/Мой список/)).toBeInTheDocument();
  });

  it("calls onCreateWorkspaceInvitation on invite submit", () => {
    const onCreateWorkspaceInvitation = vi.fn().mockResolvedValue(undefined);
    render(
      <SettingsView
        {...createProps({
          workspaceInviteEmail: "friend@example.com",
          onCreateWorkspaceInvitation
        })}
      />
    );
    fireEvent.submit(document.querySelector(".ds-workspace-invite-form")!);
    expect(onCreateWorkspaceInvitation).toHaveBeenCalledOnce();
  });

  it("does not render reminder cycle settings", () => {
    render(<SettingsView {...createProps()} />);
    expect(screen.queryByRole("heading", { name: "Напоминания" })).not.toBeInTheDocument();
    expect(screen.queryByText("Сохранить категории")).not.toBeInTheDocument();
  });

  it("calls onExportUserData when export button is clicked", () => {
    const onExportUserData = vi.fn().mockResolvedValue(undefined);
    render(<SettingsView {...createProps({ onExportUserData })} />);
    fireEvent.click(screen.getByRole("button", { name: "Скачать JSON" }));
    expect(onExportUserData).toHaveBeenCalledOnce();
  });

  it("calls onSignOut when sign out button is clicked", () => {
    const onSignOut = vi.fn();
    render(<SettingsView {...createProps({ onSignOut })} />);
    fireEvent.click(screen.getByRole("button", { name: "Выйти" }));
    expect(onSignOut).toHaveBeenCalledOnce();
  });

  it("calls onDeleteAccount when delete button is clicked", () => {
    const onDeleteAccount = vi.fn().mockResolvedValue(undefined);
    render(<SettingsView {...createProps({ onDeleteAccount })} />);
    fireEvent.click(screen.getByRole("button", { name: "Удалить аккаунт" }));
    expect(onDeleteAccount).toHaveBeenCalledOnce();
  });
});
