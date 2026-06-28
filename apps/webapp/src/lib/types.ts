import type { CategoryStatus, ItemStatus, ShoppingPriority } from "@kupitnezabyt/shared";

export type Category = {
  id: string;
  name: string;
  icon: string | null;
  sortOrder: number;
  usageCycleDays: number | null;
  nextCheckAt: string | null;
  reminderEnabled: boolean;
  archivedAt: string | null;
  itemCount: number;
  aggregateStatus: CategoryStatus;
};

export type Item = {
  id: string;
  userId: string;
  categoryId: string;
  name: string;
  brand: string | null;
  notes: string | null;
  status: ItemStatus;
  usageCycleDays: number | null;
  reminderEnabled: boolean;
  lastCheckedAt: string | null;
  lastBoughtAt: string | null;
  nextCheckAt: string | null;
  archivedAt: string | null;
  category?: Category | null;
};

export type ShoppingListEntry = {
  id: string;
  title: string;
  itemId: string | null;
  categoryId: string | null;
  priority: ShoppingPriority;
  category: Category | null;
  item: Item | null;
};

export type CheckSessionStatus = "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

export type CheckSessionItem = {
  id: string;
  sessionId: string;
  itemId: string;
  sortOrder: number;
  selectedStatus: ItemStatus | null;
  checkedAt: string | null;
  item: Item;
};

export type CheckSession = {
  id: string;
  categoryId: string | null;
  groupId: string | null;
  status: CheckSessionStatus;
  startedAt: string;
  completedAt: string | null;
  category: Category | null;
  group: ItemGroup | null;
  items: CheckSessionItem[];
};

export type ItemGroupItem = {
  id: string;
  groupId: string;
  itemId: string;
  createdAt: string;
  item: Item;
};

export type ItemGroup = {
  id: string;
  name: string;
  icon: string | null;
  usageCycleDays: number | null;
  nextCheckAt: string | null;
  reminderEnabled: boolean;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
  items: ItemGroupItem[];
};

export type InAppReminder = {
  id: string;
  entityId: string;
  entityType: "CATEGORY" | "GROUP" | "ITEM";
  title: string;
  nextCheckAt: string;
  timing: "DUE" | "UPCOMING";
};

export type RecommendationSuggestion = {
  id: string;
  ruleId: string;
  suggestedItem: string;
  categoryHint: string | null;
};

export type AuthResponse = {
  token: string;
};

export type MagicLinkRequestResponse = {
  sent: boolean;
  devMagicLink?: string;
};

export type OAuthStartResponse = {
  authUrl: string;
};

export type WorkspaceInvitationAcceptResponse = {
  accepted: boolean;
  member: {
    id: string;
    workspaceId: string;
    userId: string;
    role: "OWNER" | "EDITOR" | "VIEWER";
    joinedAt: string | null;
  };
};

export type WorkspaceSummary = {
  id: string;
  name: string;
  ownerId: string;
  role: "OWNER" | "EDITOR" | "VIEWER";
  joinedAt: string | null;
  memberCount: number;
  owner: {
    id: string;
    email: string | null;
    displayName: string | null;
    firstName: string | null;
  };
};

export type WorkspaceInvitation = {
  id: string;
  email: string;
  role: "OWNER" | "EDITOR" | "VIEWER";
  expiresAt: string;
  createdAt: string;
};

export type WorkspaceMember = {
  id: string;
  role: "OWNER" | "EDITOR" | "VIEWER";
  joinedAt: string | null;
  user: {
    id: string;
    email: string | null;
    displayName: string | null;
    firstName: string | null;
  };
};

export type WorkspaceInvitationsResponse = {
  workspace: {
    id: string;
    name: string;
  };
  invitations: WorkspaceInvitation[];
  members: WorkspaceMember[];
};

export type WorkspaceInvitationCreateResponse = {
  sent: boolean;
  invitation: {
    id: string;
    workspaceId: string;
    email: string;
    role: "OWNER" | "EDITOR" | "VIEWER";
    expiresAt: string;
  };
  devInvitationLink?: string;
};

export type WorkspaceMemberRemoveResponse = {
  removed: boolean;
};

export type WorkspaceOwnershipTransferResponse = {
  transferred: boolean;
  workspaceId: string;
  ownerId: string;
};

export type DeletedCountResponse = {
  deletedCount: number;
};

export type DeleteResponse = {
  deleted: boolean;
};

export type UserDataExport = {
  schemaVersion: 1;
  exportedAt: string;
  data: Record<string, unknown>;
};
