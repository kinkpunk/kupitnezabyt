"use client";

import { Download, LogOut, Trash2 } from "lucide-react";
import React from "react";
import { formatError } from "../../lib/format";
import { WorkspacePanel } from "../features/WorkspacePanel";
import { Button } from "../ui/Button";
import { SectionHeader, ThemeSwitcher } from "../common";
import type { WorkspaceSummary } from "../../lib/types";
import type { ThemeMode } from "../../lib/ui";

export function SettingsView({
  activeWorkspace,
  canManageActiveWorkspace,
  workspaceMessage,
  workspaceInviteEmail,
  setWorkspaceInviteEmail,
  workspaceAction,
  devInvitationLink,
  isLoadingWorkspaceAccess,
  workspaceLoadFailed,
  workspaceMembers,
  workspaceInvitations,
  theme,
  onThemeChange,
  onCreateWorkspaceInvitation,
  onRevokeWorkspaceInvitation,
  onRemoveWorkspaceMember,
  onTransferWorkspaceOwnership,
  onRetryWorkspaceLoad,
  onExportUserData,
  onDeleteAccount,
  onSignOut,
  setError
}: {
  activeWorkspace: WorkspaceSummary | null;
  canManageActiveWorkspace: boolean;
  workspaceMessage: string | null;
  workspaceInviteEmail: string;
  setWorkspaceInviteEmail: (value: string) => void;
  workspaceAction: string | null;
  devInvitationLink: string | null;
  isLoadingWorkspaceAccess: boolean;
  workspaceLoadFailed: boolean;
  workspaceMembers: import("../../lib/types").WorkspaceMember[];
  workspaceInvitations: import("../../lib/types").WorkspaceInvitation[];
  theme: ThemeMode;
  onThemeChange: (theme: ThemeMode) => void;
  onCreateWorkspaceInvitation: () => Promise<void>;
  onRevokeWorkspaceInvitation: (
    invitation: import("../../lib/types").WorkspaceInvitation
  ) => Promise<void>;
  onRemoveWorkspaceMember: (member: import("../../lib/types").WorkspaceMember) => Promise<void>;
  onTransferWorkspaceOwnership: (
    member: import("../../lib/types").WorkspaceMember
  ) => Promise<void>;
  onRetryWorkspaceLoad: () => Promise<void>;
  onExportUserData: () => Promise<void>;
  onDeleteAccount: () => Promise<void>;
  onSignOut: () => void;
  setError: (message: string | null) => void;
}) {
  return (
    <div className="ds-settings">
      <section aria-label="Тема оформления">
        <SectionHeader title="Тема оформления" />
        <ThemeSwitcher theme={theme} onChange={onThemeChange} />
      </section>

      <WorkspacePanel
        activeWorkspace={activeWorkspace}
        canManageActiveWorkspace={canManageActiveWorkspace}
        workspaceMessage={workspaceMessage}
        devInvitationLink={devInvitationLink}
        workspaceInviteEmail={workspaceInviteEmail}
        onInviteEmailChange={setWorkspaceInviteEmail}
        workspaceAction={workspaceAction}
        workspaceLoadFailed={workspaceLoadFailed}
        isLoadingWorkspaceAccess={isLoadingWorkspaceAccess}
        workspaceMembers={workspaceMembers}
        workspaceInvitations={workspaceInvitations}
        onCreateInvitation={onCreateWorkspaceInvitation}
        onRevokeInvitation={onRevokeWorkspaceInvitation}
        onRemoveMember={onRemoveWorkspaceMember}
        onTransferOwnership={onTransferWorkspaceOwnership}
        onRetryLoad={onRetryWorkspaceLoad}
      />

      <div className="ds-settings-actions">
        <Button
          type="button"
          variant="accent"
          onClick={() =>
            void onExportUserData().catch((caughtError) =>
              setError(formatError(caughtError))
            )
          }
        >
          <Download aria-hidden="true" size={16} />
          Скачать JSON
        </Button>
        <Button variant="ghost" type="button" onClick={onSignOut}>
          <LogOut aria-hidden="true" size={16} />
          Выйти
        </Button>
      </div>
      <div className="ds-settings-danger">
        <Button
          className="ds-button--danger"
          variant="ghost"
          type="button"
          onClick={() =>
            void onDeleteAccount().catch((caughtError) =>
              setError(formatError(caughtError))
            )
          }
        >
          <Trash2 aria-hidden="true" size={16} />
          Удалить аккаунт
        </Button>
      </div>
    </div>
  );
}
