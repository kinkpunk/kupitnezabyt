import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import type { Category, Item, ItemGroup, WorkspaceInvitation, WorkspaceMember, WorkspaceSummary } from "../../lib/types";
import type { ReminderDraft } from "../../hooks/useAppState";
import { SettingsView } from "./SettingsView";

const category: Category = {
  id: "cat-1",
  name: "Еда",
  icon: null,
  sortOrder: 0,
  usageCycleDays: 7,
  nextCheckAt: null,
  reminderEnabled: false,
  archivedAt: null,
  itemCount: 1,
  aggregateStatus: "OK"
};

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
    categories: [category],
    groups: [] as ItemGroup[],
    items: [] as Item[],
    theme: "system" as const,
    onThemeChange: vi.fn(),
    reminderSettingsMessage: null,
    savingReminderKeys: [] as string[],
    reminderDrafts: {
      "CATEGORY:cat-1": { usageCycleDays: "7", reminderEnabled: true } as ReminderDraft
    },
    onCreateWorkspaceInvitation: vi.fn().mockResolvedValue(undefined),
    onRevokeWorkspaceInvitation: vi.fn().mockResolvedValue(undefined),
    onRemoveWorkspaceMember: vi.fn().mockResolvedValue(undefined),
    onTransferWorkspaceOwnership: vi.fn().mockResolvedValue(undefined),
    onRetryWorkspaceLoad: vi.fn().mockResolvedValue(undefined),
    onSaveReminderSettingsGroup: vi.fn(),
    onUpdateReminderDraft: vi.fn(),
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
    expect(screen.getByRole("heading", { name: "Настройки" })).toBeInTheDocument();
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

  it("renders reminder settings sections with rows", () => {
    render(<SettingsView {...createProps()} />);
    expect(screen.getByRole("heading", { name: "Проверки" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Категории" })).toBeInTheDocument();
    expect(screen.getByText("Еда")).toBeInTheDocument();
  });

  it("calls onUpdateReminderDraft when toggle changes", () => {
    const onUpdateReminderDraft = vi.fn();
    render(<SettingsView {...createProps({ onUpdateReminderDraft })} />);
    fireEvent.click(screen.getByRole("checkbox", { name: "Напоминания: Еда" }));
    expect(onUpdateReminderDraft).toHaveBeenCalledWith("CATEGORY:cat-1", {
      usageCycleDays: "7",
      reminderEnabled: false
    });
  });

  it("calls onSaveReminderSettingsGroup when save button is clicked", () => {
    const onSaveReminderSettingsGroup = vi.fn();
    render(<SettingsView {...createProps({ onSaveReminderSettingsGroup })} />);
    fireEvent.click(screen.getByRole("button", { name: "Сохранить категории" }));
    expect(onSaveReminderSettingsGroup).toHaveBeenCalledWith("CATEGORY", [category.id]);
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
