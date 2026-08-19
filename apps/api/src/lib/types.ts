export type NamedBody = {
  name?: unknown;
  icon?: unknown;
};

export type CheckSettingsBody = {
  name?: unknown;
  icon?: unknown;
  usageCycleDays?: unknown;
  nextCheckAt?: unknown;
  reminderEnabled?: unknown;
};

export type CreateItemBody = {
  categoryId?: unknown;
  name?: unknown;
  brand?: unknown;
  notes?: unknown;
  importance?: unknown;
  usageCycleDays?: unknown;
};

export type UpdateItemBody = {
  categoryId?: unknown;
  name?: unknown;
  brand?: unknown;
  notes?: unknown;
  importance?: unknown;
  usageCycleDays?: unknown;
  nextCheckAt?: unknown;
  reminderEnabled?: unknown;
};

export type StatusBody = {
  status?: unknown;
};

export type SnoozeBody = {
  days?: unknown;
};

export type DevAuthBody = {
  telegramUserId?: unknown;
  firstName?: unknown;
};

export type TelegramAuthBody = {
  initData?: unknown;
};

export type EmailAuthRequestBody = {
  email?: unknown;
};

export type EmailAuthVerifyBody = {
  token?: unknown;
};

export type WorkspaceInvitationBody = {
  email?: unknown;
};

export type WorkspaceInvitationAcceptBody = {
  token?: unknown;
};

export type WorkspaceTransferOwnershipBody = {
  memberId?: unknown;
};

export type GoogleAuthCallbackQuery = {
  code?: string;
  error?: string;
  state?: string;
};

export type AppleAuthCallbackBody = {
  code?: string;
  error?: string;
  state?: string;
};

export type ShoppingListBody = {
  title?: unknown;
  categoryId?: unknown;
  priority?: unknown;
};

export type GroupItemBody = {
  itemId?: unknown;
};

export type AcceptRecommendationBody = {
  categoryId?: unknown;
};

export type ReorderCategoriesBody = {
  categoryIds?: unknown;
};

export type ReorderItemsBody = {
  categoryId?: unknown;
  itemIds?: unknown;
};

export type WorkspaceAccess = {
  role: "OWNER" | "EDITOR" | "VIEWER";
  workspaceId: string;
};

export type ArchivedQuery = {
  archived?: string;
};

export type RemindersQuery = {
  days?: string;
};
