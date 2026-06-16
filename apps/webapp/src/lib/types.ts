import type { CategoryStatus, ItemStatus, ShoppingPriority } from "@kupitnezabyt/shared";

export type Category = {
  id: string;
  name: string;
  icon: string | null;
  sortOrder: number;
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
  lastCheckedAt: string | null;
  lastBoughtAt: string | null;
  nextCheckAt: string | null;
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

export type RecommendationSuggestion = {
  id: string;
  ruleId: string;
  suggestedItem: string;
  categoryHint: string | null;
};

export type AuthResponse = {
  token: string;
};

export type DeletedCountResponse = {
  deletedCount: number;
};

export type DeleteResponse = {
  deleted: boolean;
};
