"use client";

import { Crown, Send, UserMinus, Users } from "lucide-react";

import { formatDate } from "../../lib/format";
import { formatWorkspaceMemberName } from "../../hooks/useAppState";
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
      <section className="workspace-panel" aria-label="Поделиться списком">
        <div className="section-heading">
          <div>
            <h2>Поделиться списком</h2>
            <p>Не удалось загрузить данные списка, поэтому приглашения пока недоступны.</p>
            <p>
              Проверьте, что backend развернут с поддержкой совместных списков, и обновите
              списки.
            </p>
          </div>
          <Users aria-hidden="true" size={22} />
        </div>
        {workspaceLoadFailed ? (
          <p className="workspace-warning">Сервис списков сейчас не ответил.</p>
        ) : null}
        <button
          className="ghost-button workspace-retry-button"
          type="button"
          onClick={() => void onRetryLoad()}
        >
          Обновить списки
        </button>
      </section>
    );
  }

  const workspaceRoleLabels: Record<WorkspaceSummary["role"], string> = {
    OWNER: "Владелец",
    EDITOR: "Редактор",
    VIEWER: "Просмотр"
  };

  return (
    <section className="workspace-panel" aria-label="Поделиться списком">
      <div className="section-heading">
        <div>
          <h2>Поделиться списком</h2>
          <p>
            {activeWorkspace.name} · {workspaceRoleLabels[activeWorkspace.role]} ·{" "}
            {activeWorkspace.memberCount}{" "}
            {activeWorkspace.memberCount === 1 ? "участник" : "участника"}
          </p>
          <p>
            Приглашенный пользователь получит доступ ко всему этому списку. Сейчас можно
            приглашать только email, который уже входил в сервис.
          </p>
        </div>
        <Users aria-hidden="true" size={22} />
      </div>

      {workspaceMessage ? <p className="success-message">{workspaceMessage}</p> : null}

      {canManageActiveWorkspace ? (
        <>
          <form
            className="workspace-invite-form"
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
            <button
              type="submit"
              aria-label="Отправить приглашение"
              disabled={workspaceAction === "invite" || !workspaceInviteEmail.trim()}
            >
              <Send aria-hidden="true" size={18} />
              <span>
                {workspaceAction === "invite" ? "Отправляем..." : "Поделиться"}
              </span>
            </button>
          </form>
          {devInvitationLink ? (
            <p className="dev-link">
              Dev-ссылка: <span>{devInvitationLink}</span>
            </p>
          ) : null}

          <div className="workspace-lists">
            <div>
              <h3>Участники</h3>
              <div className="workspace-list">
                {isLoadingWorkspaceAccess ? (
                  <p className="empty">Загружаем участников...</p>
                ) : workspaceLoadFailed ? (
                  <p className="empty">Не удалось загрузить участников. Обновите доступ.</p>
                ) : workspaceMembers.length ? (
                  workspaceMembers.map((member) => {
                    const isCurrentOwner = member.user.id === activeWorkspace.ownerId;

                    return (
                      <article className="workspace-row" key={member.id}>
                        <div>
                          <h4>{formatWorkspaceMemberName(member)}</h4>
                          <p>{workspaceRoleLabels[member.role]}</p>
                        </div>
                        {!isCurrentOwner ? (
                          <div className="workspace-row-actions">
                            <button
                              className="ghost-button"
                              type="button"
                              disabled={workspaceAction !== null}
                              onClick={() => void onTransferOwnership(member)}
                            >
                              <Crown aria-hidden="true" size={17} />
                              <span>
                                {workspaceAction === "transfer" ? "Передаем..." : "Передать"}
                              </span>
                            </button>
                            <button
                              className="ghost-button danger-button icon-button"
                              type="button"
                              aria-label={`Удалить доступ для ${formatWorkspaceMemberName(member)}`}
                              disabled={workspaceAction !== null}
                              onClick={() => void onRemoveMember(member)}
                            >
                              <UserMinus aria-hidden="true" size={17} />
                            </button>
                          </div>
                        ) : null}
                      </article>
                    );
                  })
                ) : (
                  <p className="empty">Участников пока нет.</p>
                )}
              </div>
            </div>

            <div>
              <h3>Приглашения</h3>
              <div className="workspace-list">
                {isLoadingWorkspaceAccess ? (
                  <p className="empty">Загружаем приглашения...</p>
                ) : workspaceLoadFailed ? (
                  <button
                    className="ghost-button workspace-retry-button"
                    type="button"
                    onClick={() => void onRetryLoad()}
                  >
                    Обновить доступ
                  </button>
                ) : workspaceInvitations.length ? (
                  workspaceInvitations.map((invitation) => (
                    <article className="workspace-row" key={invitation.id}>
                      <div>
                        <h4>{invitation.email}</h4>
                        <p>До {formatDate(invitation.expiresAt)}</p>
                      </div>
                      <button
                        className="ghost-button"
                        type="button"
                        disabled={workspaceAction !== null}
                        onClick={() => void onRevokeInvitation(invitation)}
                      >
                        {workspaceAction === `revoke:${invitation.id}`
                          ? "Отзываем..."
                          : "Отозвать"}
                      </button>
                    </article>
                  ))
                ) : (
                  <p className="empty">Активных приглашений нет.</p>
                )}
              </div>
            </div>
          </div>
        </>
      ) : (
        <p className="empty">
          Управлять доступом может владелец списка. Вы можете работать с товарами в
          текущем списке.
        </p>
      )}
    </section>
  );
}
