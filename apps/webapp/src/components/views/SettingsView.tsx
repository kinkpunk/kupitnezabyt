"use client";

import { formatDate, formatError } from "../../lib/format";
import { WorkspacePanel } from "../features/WorkspacePanel";
import { ReminderSettingsSection } from "../ui/ReminderSettingsSection";
import type { Category, Item, ItemGroup, WorkspaceSummary } from "../../lib/types";
import type {
  ReminderDraft
} from "../../hooks/useAppState";

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
      <div className="section-heading">
        <div>
          <h2>Настройки</h2>
          <p>Совместный доступ, проверки, экспорт и удаление данных</p>
        </div>
      </div>

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

      <section className="reminder-settings" aria-label="Настройки проверок">
        <div className="section-heading">
          <div>
            <h2>Проверки</h2>
            <p>Циклы для напоминаний внутри приложения</p>
          </div>
        </div>

        {reminderSettingsMessage ? (
          <p className="success-message" role="status">
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

      <div className="settings-actions">
        <button
          type="button"
          onClick={() =>
            void onExportUserData().catch((caughtError) =>
              setError(formatError(caughtError))
            )
          }
        >
          Скачать JSON
        </button>
        <button className="ghost-button" type="button" onClick={onSignOut}>
          Выйти
        </button>
        <button
          className="ghost-button danger-button"
          type="button"
          onClick={() =>
            void onDeleteAccount().catch((caughtError) =>
              setError(formatError(caughtError))
            )
          }
        >
          Удалить аккаунт
        </button>
      </div>
    </section>
  );
}
