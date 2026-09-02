"use client";

import React from "react";
import { formatDate, formatError } from "../../lib/format";
import { WorkspacePanel } from "../features/WorkspacePanel";
import { ReminderSettingsSection } from "../ui/ReminderSettingsSection";
import { Button } from "../ui/Button";
import { SectionHeader, ThemeSwitcher } from "../common";
import type { Category, Item, ItemGroup, WorkspaceSummary } from "../../lib/types";
import type { ReminderDraft } from "../../hooks/useAppState";
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
  categories,
  groups,
  items,
  theme,
  onThemeChange,
  reminderSettingsMessage,
  savingReminderKeys,
  reminderDrafts,
  onCreateWorkspaceInvitation,
  onRevokeWorkspaceInvitation,
  onRemoveWorkspaceMember,
  onTransferWorkspaceOwnership,
  onRetryWorkspaceLoad,
  onSaveReminderSettingsGroup,
  onUpdateReminderDraft,
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
  categories: Category[];
  groups: ItemGroup[];
  items: Item[];
  theme: ThemeMode;
  onThemeChange: (theme: ThemeMode) => void;
  reminderSettingsMessage: string | null;
  savingReminderKeys: string[];
  reminderDrafts: Record<string, ReminderDraft>;
  onCreateWorkspaceInvitation: () => Promise<void>;
  onRevokeWorkspaceInvitation: (
    invitation: import("../../lib/types").WorkspaceInvitation
  ) => Promise<void>;
  onRemoveWorkspaceMember: (member: import("../../lib/types").WorkspaceMember) => Promise<void>;
  onTransferWorkspaceOwnership: (
    member: import("../../lib/types").WorkspaceMember
  ) => Promise<void>;
  onRetryWorkspaceLoad: () => Promise<void>;
  onSaveReminderSettingsGroup: (entityType: "CATEGORY" | "GROUP" | "ITEM", ids: string[]) => void;
  onUpdateReminderDraft: (key: string, draft: ReminderDraft) => void;
  onExportUserData: () => Promise<void>;
  onDeleteAccount: () => Promise<void>;
  onSignOut: () => void;
  setError: (message: string | null) => void;
}) {
  return (
    <section className="stack">
      <SectionHeader
        title="Настройки"
        subtitle="Совместный доступ, проверки, экспорт и удаление данных"
      />

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

      <section aria-label="Настройки проверок">
        <SectionHeader
          title="Проверки"
          subtitle="Циклы для напоминаний внутри приложения"
        />

        {reminderSettingsMessage ? (
          <p className="ds-inline-message ds-inline-message--success" role="status">
            {reminderSettingsMessage}
          </p>
        ) : null}

        <ReminderSettingsSection
          title="Категории"
          emptyMessage="Создайте категорию, чтобы настроить цикл проверки."
          saveLabel="Сохранить категории"
          isSaving={savingReminderKeys.includes("CATEGORY:SECTION")}
          rows={categories.map((category) => ({
            id: category.id,
            entityType: "CATEGORY" as const,
            title: category.name,
            subtitle: category.nextCheckAt
              ? `Следующая: ${formatDate(category.nextCheckAt)}`
              : "Дата не задана"
          }))}
          drafts={reminderDrafts}
          onDraftChange={onUpdateReminderDraft}
          onSave={() =>
            void onSaveReminderSettingsGroup(
              "CATEGORY",
              categories.map((category) => category.id)
            )
          }
        />

        <ReminderSettingsSection
          title="Наборы"
          emptyMessage="Создайте набор, чтобы настроить совместную проверку."
          saveLabel="Сохранить наборы"
          isSaving={savingReminderKeys.includes("GROUP:SECTION")}
          rows={groups.map((group) => ({
            id: group.id,
            entityType: "GROUP" as const,
            title: group.name,
            subtitle: group.nextCheckAt
              ? `Следующая: ${formatDate(group.nextCheckAt)}`
              : "Дата не задана"
          }))}
          drafts={reminderDrafts}
          onDraftChange={onUpdateReminderDraft}
          onSave={() =>
            void onSaveReminderSettingsGroup(
              "GROUP",
              groups.map((group) => group.id)
            )
          }
        />

        <ReminderSettingsSection
          title="Товары"
          emptyMessage="Добавьте товар, чтобы настроить индивидуальную проверку."
          saveLabel="Сохранить товары"
          isSaving={savingReminderKeys.includes("ITEM:SECTION")}
          rows={items.map((item) => ({
            id: item.id,
            entityType: "ITEM" as const,
            title: item.name,
            subtitle: item.nextCheckAt
              ? `Следующая: ${formatDate(item.nextCheckAt)}`
              : "Дата не задана"
          }))}
          drafts={reminderDrafts}
          onDraftChange={onUpdateReminderDraft}
          onSave={() =>
            void onSaveReminderSettingsGroup(
              "ITEM",
              items.map((item) => item.id)
            )
          }
        />
      </section>

      <div className="ds-settings-actions">
        <Button
          type="button"
          onClick={() =>
            void onExportUserData().catch((caughtError) =>
              setError(formatError(caughtError))
            )
          }
        >
          Скачать JSON
        </Button>
        <Button variant="ghost" type="button" onClick={onSignOut}>
          Выйти
        </Button>
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
          Удалить аккаунт
        </Button>
      </div>
    </section>
  );
}
