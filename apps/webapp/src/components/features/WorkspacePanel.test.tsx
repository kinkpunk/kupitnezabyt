import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import type { WorkspaceInvitation, WorkspaceMember, WorkspaceSummary } from "../../lib/types";
import { WorkspacePanel } from "./WorkspacePanel";

const activeWorkspace: WorkspaceSummary = {
  id: "ws-1",
  name: "Дом",
  ownerId: "u1",
  role: "OWNER",
  joinedAt: "2026-09-01T00:00:00Z",
  memberCount: 2,
  owner: { id: "u1", email: "owner@example.com", displayName: "Owner", firstName: "Owner" }
};

const member: WorkspaceMember = {
  id: "m-1",
  role: "EDITOR",
  joinedAt: "2026-09-01T00:00:00Z",
  user: { id: "u2", email: "member@example.com", displayName: "Member", firstName: "Member" }
};

const invitation: WorkspaceInvitation = {
  id: "inv-1",
  email: "invited@example.com",
  role: "EDITOR",
  expiresAt: "2026-09-10T00:00:00Z",
  createdAt: "2026-09-01T00:00:00Z"
};

function createProps(overrides: Partial<React.ComponentProps<typeof WorkspacePanel>> = {}) {
  return {
    activeWorkspace,
    canManageActiveWorkspace: true,
    workspaceMessage: null,
    devInvitationLink: null,
    workspaceInviteEmail: "",
    onInviteEmailChange: vi.fn(),
    workspaceAction: null,
    workspaceLoadFailed: false,
    isLoadingWorkspaceAccess: false,
    workspaceMembers: [member],
    workspaceInvitations: [invitation],
    onCreateInvitation: vi.fn().mockResolvedValue(undefined),
    onRevokeInvitation: vi.fn().mockResolvedValue(undefined),
    onRemoveMember: vi.fn().mockResolvedValue(undefined),
    onTransferOwnership: vi.fn().mockResolvedValue(undefined),
    onRetryLoad: vi.fn().mockResolvedValue(undefined),
    ...overrides
  };
}

describe("WorkspacePanel", () => {
  beforeEach(() => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders no workspace state", () => {
    render(<WorkspacePanel {...createProps({ activeWorkspace: null })} />);
    expect(screen.getByRole("heading", { name: "Поделиться списком" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Обновить списки" })).toBeInTheDocument();
  });

  it("calls onRetryLoad in no workspace state", () => {
    const onRetryLoad = vi.fn().mockResolvedValue(undefined);
    render(<WorkspacePanel {...createProps({ activeWorkspace: null, onRetryLoad })} />);
    fireEvent.click(screen.getByRole("button", { name: "Обновить списки" }));
    expect(onRetryLoad).toHaveBeenCalledOnce();
  });

  it("renders workspace info and invite form", () => {
    render(<WorkspacePanel {...createProps()} />);
    expect(screen.getByText(/Дом/)).toBeInTheDocument();
    expect(screen.getByLabelText("Email участника")).toBeInTheDocument();
  });

  it("submits invite form", () => {
    const onCreateInvitation = vi.fn().mockResolvedValue(undefined);
    render(
      <WorkspacePanel
        {...createProps({ workspaceInviteEmail: "friend@example.com", onCreateInvitation })}
      />
    );
    fireEvent.submit(document.querySelector(".ds-workspace-invite-form")!);
    expect(onCreateInvitation).toHaveBeenCalledOnce();
  });

  it("renders members and transfers ownership", () => {
    const onTransferOwnership = vi.fn().mockResolvedValue(undefined);
    render(<WorkspacePanel {...createProps({ onTransferOwnership })} />);
    expect(screen.getByText("Member")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Передать" }));
    expect(onTransferOwnership).toHaveBeenCalledWith(member);
  });

  it("removes member after confirm", () => {
    const onRemoveMember = vi.fn().mockResolvedValue(undefined);
    render(<WorkspacePanel {...createProps({ onRemoveMember })} />);
    fireEvent.click(screen.getByRole("button", { name: `Удалить доступ для ${member.user.displayName}` }));
    expect(onRemoveMember).toHaveBeenCalledWith(member);
  });

  it("revokes invitation", () => {
    const onRevokeInvitation = vi.fn().mockResolvedValue(undefined);
    render(<WorkspacePanel {...createProps({ onRevokeInvitation })} />);
    expect(screen.getByText("invited@example.com")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Отозвать" }));
    expect(onRevokeInvitation).toHaveBeenCalledWith(invitation);
  });

  it("shows viewer message when cannot manage workspace", () => {
    render(<WorkspacePanel {...createProps({ canManageActiveWorkspace: false })} />);
    expect(screen.getByText(/Управлять доступом может владелец/)).toBeInTheDocument();
  });

  it("shows load failed state and retry button", () => {
    const onRetryLoad = vi.fn().mockResolvedValue(undefined);
    render(
      <WorkspacePanel
        {...createProps({
          workspaceLoadFailed: true,
          workspaceMembers: [],
          workspaceInvitations: [],
          onRetryLoad
        })}
      />
    );
    expect(screen.getByText(/Не удалось загрузить участников/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Обновить доступ" }));
    expect(onRetryLoad).toHaveBeenCalledOnce();
  });
});
