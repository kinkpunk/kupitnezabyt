"use client";

import { Crown, Send, UserMinus } from "lucide-react";

import { formatDate } from "../../lib/format";
import { formatWorkspaceMemberName } from "../../hooks/useAppState";
import { ProductRow, SectionHeader } from "../common";
import { Button } from "../ui/Button";
import type {
  WorkspaceInvitation,
  WorkspaceMember,
  WorkspaceSummary
} from "../../lib/types";

export function WorkspacePanel({
  activeWorkspace,
  canManageActiveWorkspace,
  workspaceMessage,
  devInvitationLink,
  workspaceInviteEmail,
  onInviteEmailChange,
  workspaceAction,
  workspaceLoadFailed,
  isLoadingWorkspaceAccess,
  workspaceMembers,
  workspaceInvitations,
  onCreateInvitation,
  onRevokeInvitation,
  onRemoveMember,
  onTransferOwnership,
  onRetryLoad
}: {
  activeWorkspace: WorkspaceSummary | null;
  canManageActiveWorkspace: boolean;
  workspaceMessage: string | null;
  devInvitationLink: string | null;
  workspaceInviteEmail: string;
  onInviteEmailChange: (value: string) => void;
  workspaceAction: string | null;
  workspaceLoadFailed: boolean;
  isLoadingWorkspaceAccess: boolean;
  workspaceMembers: WorkspaceMember[];
  workspaceInvitations: WorkspaceInvitation[];
  onCreateInvitation: () => Promise<void>;
  onRevokeInvitation: (invitation: WorkspaceInvitation) => Promise<void>;
  onRemoveMember: (member: WorkspaceMember) => Promise<void>;
  onTransferOwnership: (member: WorkspaceMember) => Promise<void>;
  onRetryLoad: () => Promise<void>;
}) {
  if (!activeWorkspace) {
    return (
      <section className="ds-settings-section" aria-label="Поделиться списком">
        <SectionHeader
          title="Поделиться списком"
          subtitle="Не удалось загрузить данные списка, поэтому приглашения пока недоступны. Проверьте, что backend развернут с поддержкой совместных списков, и обновите списки."
        />
        {workspaceLoadFailed ? (
          <p className="ds-inline-message ds-inline-message--warning">
            Сервис списков сейчас не ответил.
          </p>
        ) : null}
        <Button
          className="ds-workspace-retry-button"
          variant="ghost"
          onClick={() => void onRetryLoad()}
        >
          Обновить списки
        </Button>
      </section>
    );
  }

  const workspaceRoleLabels: Record<WorkspaceSummary["role"], string> = {
    OWNER: "Владелец",
    EDITOR: "Редактор",
    VIEWER: "Просмотр"
  };

  const memberCountLabel =
    activeWorkspace.memberCount === 1 ? "участник" : "участника";

  return (
    <section className="ds-settings-section" aria-label="Поделиться списком">
      <SectionHeader
        title="Поделиться списком"
        subtitle={`${activeWorkspace.name} · ${workspaceRoleLabels[activeWorkspace.role]} · ${activeWorkspace.memberCount} ${memberCountLabel}`}
      />

      {workspaceMessage ? (
        <p className="ds-inline-message ds-inline-message--success">
          {workspaceMessage}
        </p>
      ) : null}

      {canManageActiveWorkspace ? (
        <>
          <form
            className="ds-workspace-invite-form"
            onSubmit={(event) => {
              event.preventDefault();
              void onCreateInvitation();
            }}
          >
            <input
              aria-label="Email участника"
              inputMode="email"
              placeholder="email пользователя в сервисе"
              value={workspaceInviteEmail}
              disabled={workspaceAction === "invite"}
              onChange={(event) => onInviteEmailChange(event.target.value)}
            />
            <Button
              type="submit"
              aria-label="Отправить приглашение"
              disabled={workspaceAction === "invite" || !workspaceInviteEmail.trim()}
            >
              <Send aria-hidden="true" size={18} />
              <span>
                {workspaceAction === "invite" ? "Отправляем..." : "Поделиться"}
              </span>
            </Button>
          </form>
          {devInvitationLink ? (
            <p className="ds-workspace-dev-link">
              Dev-ссылка: <span>{devInvitationLink}</span>
            </p>
          ) : null}

          <div className="ds-workspace-lists">
            <section aria-label="Участники">
              <SectionHeader title="Участники" />
              <div className="ds-product-list">
                {isLoadingWorkspaceAccess ? (
                  <p className="ds-empty">Загружаем участников...</p>
                ) : workspaceLoadFailed ? (
                  <p className="ds-empty">
                    Не удалось загрузить участников. Обновите доступ.
                  </p>
                ) : workspaceMembers.length ? (
                  workspaceMembers.map((member) => {
                    const isCurrentOwner = member.user.id === activeWorkspace.ownerId;

                    return (
                      <ProductRow
                        key={member.id}
                        actions={
                          !isCurrentOwner ? (
                            <>
                              <Button
                                size="compact"
                                variant="ghost"
                                disabled={workspaceAction !== null}
                                onClick={() => void onTransferOwnership(member)}
                              >
                                <Crown aria-hidden="true" size={16} />
                                <span>
                                  {workspaceAction === "transfer"
                                    ? "Передаем..."
                                    : "Передать"}
                                </span>
                              </Button>
                              <Button
                                size="compact"
                                variant="icon"
                                aria-label={`Удалить доступ для ${formatWorkspaceMemberName(member)}`}
                                title="Удалить доступ"
                                disabled={workspaceAction !== null}
                                onClick={() => void onRemoveMember(member)}
                              >
                                <UserMinus aria-hidden="true" size={16} />
                              </Button>
                            </>
                          ) : null
                        }
                        subtitle={workspaceRoleLabels[member.role]}
                        title={formatWorkspaceMemberName(member)}
                      />
                    );
                  })
                ) : (
                  <p className="ds-empty">Участников пока нет.</p>
                )}
              </div>
            </section>

            <section aria-label="Приглашения">
              <SectionHeader title="Приглашения" />
              <div className="ds-product-list">
                {isLoadingWorkspaceAccess ? (
                  <p className="ds-empty">Загружаем приглашения...</p>
                ) : workspaceLoadFailed ? (
                  <Button
                    className="ds-workspace-retry-button"
                    variant="ghost"
                    onClick={() => void onRetryLoad()}
                  >
                    Обновить доступ
                  </Button>
                ) : workspaceInvitations.length ? (
                  workspaceInvitations.map((invitation) => (
                    <ProductRow
                      key={invitation.id}
                      actions={
                        <Button
                          size="compact"
                          variant="ghost"
                          disabled={workspaceAction !== null}
                          onClick={() => void onRevokeInvitation(invitation)}
                        >
                          {workspaceAction === `revoke:${invitation.id}`
                            ? "Отзываем..."
                            : "Отозвать"}
                        </Button>
                      }
                      subtitle={`До ${formatDate(invitation.expiresAt)}`}
                      title={invitation.email}
                    />
                  ))
                ) : (
                  <p className="ds-empty">Активных приглашений нет.</p>
                )}
              </div>
            </section>
          </div>
        </>
      ) : (
        <p className="ds-empty">
          Управлять доступом может владелец списка. Вы можете работать с товарами
          в текущем списке.
        </p>
      )}
    </section>
  );
}
