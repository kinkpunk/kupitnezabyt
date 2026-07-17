"use client";

import type { ItemStatus, ShoppingPriority } from "@kupitnezabyt/shared";
import type { CategoryStatus } from "@kupitnezabyt/shared";
import {
  Archive,
  Bell,
  Boxes,
  Crown,
  Home,
  Mail,
  Menu,
  Pencil,
  Plus,
  Search,
  Send,
  Settings,
  ShoppingCart,
  Tags,
  UserMinus,
  Users,
  X
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import {
  ApiError,
  acceptRecommendation,
  addGroupItem,
  archiveCategory,
  archiveGroup,
  archiveItem,
  cancelCheckSession,
  clearActiveWorkspaceId,
  clearCompletedShoppingList,
  completeOnboarding,
  completeCheckSession,
  completeShoppingListItem,
  createCategory,
  createGroup,
  createItem,
  createShoppingListItem,
  clearSavedToken,
  deleteShoppingListItem,
  deleteAccount,
  deleteArchivedCategory,
  deleteArchivedItem,
  dismissRecommendation,
  exportUserData,
  getActiveCheckSession,
  getArchivedCategories,
  getArchivedItems,
  getCategories,
  getGroups,
  getInAppReminders,
  getItems,
  getMe,
  getRecommendations,
  getShoppingList,
  getActiveWorkspaceId,
  getWorkspaceInvitations,
  getWorkspaces,
  hideSimilarRecommendations,
  login,
  removeGroupItem,
  requestMagicLink,
  removeWorkspaceMember,
  revokeWorkspaceInvitation,
  restoreCategory,
  restoreItem,
  searchItems,
  setActiveWorkspaceId,
  startAppleSignIn,
  setItemStatus,
  setCheckSessionItemStatus,
  snoozeItemReminder,
  startCategoryCheckSession,
  startGroupCheckSession,
  startGoogleSignIn,
  updateCategory,
  updateGroup,
  updateItem,
  createWorkspaceInvitation,
  transferWorkspaceOwnership,
  updateShoppingListItem
} from "../lib/api";
import type {
  Category,
  CheckSession,
  InAppReminder,
  Item,
  ItemGroup,
  RecommendationSuggestion,
  ShoppingListEntry,
  WorkspaceInvitation,
  WorkspaceMember,
  WorkspaceSummary
} from "../lib/types";

const statusLabels: Record<ItemStatus, string> = {
  IN_STOCK: "Есть",
  LOW: "Мало",
  NEED_BUY: "Купить",
  URGENT: "Срочно",
  PAUSED: "Пауза"
};

const statusOptions: ItemStatus[] = ["IN_STOCK", "LOW", "NEED_BUY", "URGENT"];

const categoryStatusLabels: Record<CategoryStatus, string> = {
  OK: "OK",
  ATTENTION: "Внимание",
  NEED_BUY: "Купить",
  URGENT: "Срочно"
};

const reminderEntityLabels: Record<InAppReminder["entityType"], string> = {
  CATEGORY: "Категория",
  GROUP: "Набор",
  ITEM: "Товар"
};

const shoppingStatusLabels: Partial<Record<ItemStatus, string>> = {
  NEED_BUY: "нужно купить",
  URGENT: "срочно"
};

function formatPositionCount(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;

  if (mod10 === 1 && mod100 !== 11) {
    return `${count} позиция`;
  }

  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return `${count} позиции`;
  }

  return `${count} позиций`;
}

function formatReminderCount(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;

  if (mod10 === 1 && mod100 !== 11) {
    return `${count} напоминание`;
  }

  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return `${count} напоминания`;
  }

  return `${count} напоминаний`;
}

const workspaceRoleLabels: Record<WorkspaceSummary["role"], string> = {
  OWNER: "Владелец",
  EDITOR: "Редактор",
  VIEWER: "Просмотр"
};

const onboardingStorageKey = "kupitnezabyt.onboarding.completed";
const starterCategories = ["Еда", "Аптека", "Косметика", "Бытовая химия", "Дом"];
const starterItemHints = ["Кофе", "Ибупрофен", "Шампунь", "Стиральный порошок", "Рис"];
const reminderSnoozeDays = 3;

type StarterItemDraft = {
  name: string;
  categoryName: string;
};

const defaultStarterItems: StarterItemDraft[] = [
  { name: "Кофе", categoryName: "Еда" },
  { name: "Ибупрофен", categoryName: "Аптека" },
  { name: "Шампунь", categoryName: "Косметика" }
];

type ReminderDraft = {
  usageCycleDays: string;
  reminderEnabled: boolean;
};

type WorkspaceAction =
  | "invite"
  | "transfer"
  | `remove:${string}`
  | `revoke:${string}`;

type ActiveTab =
  | "archive"
  | "check"
  | "groups"
  | "home"
  | "items"
  | "search"
  | "settings"
  | "shopping";

const navTabs: { id: ActiveTab; icon: LucideIcon; label: string }[] = [
  { id: "home", icon: Home, label: "Главная" },
  { id: "items", icon: Tags, label: "Категории" }
];

const menuTabs: { id: ActiveTab; icon: LucideIcon; label: string }[] = [
  { id: "shopping", icon: ShoppingCart, label: "Покупки" },
  { id: "groups", icon: Boxes, label: "Наборы" },
  { id: "settings", icon: Settings, label: "Настройки" },
  { id: "archive", icon: Archive, label: "Архив" }
];

export default function HomePage() {
  const [token, setToken] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [archivedCategories, setArchivedCategories] = useState<Category[]>([]);
  const [archivedItems, setArchivedItems] = useState<Item[]>([]);
  const [groups, setGroups] = useState<ItemGroup[]>([]);
  const [shoppingList, setShoppingList] = useState<ShoppingListEntry[]>([]);
  const [inAppReminders, setInAppReminders] = useState<InAppReminder[]>([]);
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceIdState] = useState<string | null>(null);
  const [workspaceMembers, setWorkspaceMembers] = useState<WorkspaceMember[]>([]);
  const [workspaceInvitations, setWorkspaceInvitations] = useState<WorkspaceInvitation[]>([]);
  const [workspaceInviteEmail, setWorkspaceInviteEmail] = useState("");
  const [workspaceMessage, setWorkspaceMessage] = useState<string | null>(null);
  const [workspaceAction, setWorkspaceAction] = useState<WorkspaceAction | null>(null);
  const [isLoadingWorkspaceAccess, setIsLoadingWorkspaceAccess] = useState(false);
  const [devInvitationLink, setDevInvitationLink] = useState<string | null>(null);
  const [recommendations, setRecommendations] = useState<RecommendationSuggestion[]>([]);
  const [recommendationSourceItemName, setRecommendationSourceItemName] = useState<string | null>(
    null
  );
  const [recommendationSourceCategoryId, setRecommendationSourceCategoryId] = useState<
    string | null
  >(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Item[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [selectedStarterCategories, setSelectedStarterCategories] = useState<string[]>([
    "Еда",
    "Аптека",
    "Дом"
  ]);
  const [starterItems, setStarterItems] = useState<StarterItemDraft[]>(defaultStarterItems);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>("home");
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [categoryName, setCategoryName] = useState("");
  const [itemName, setItemName] = useState("");
  const [groupName, setGroupName] = useState("");
  const [groupItemId, setGroupItemId] = useState("");
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingItemName, setEditingItemName] = useState("");
  const [manualShoppingTitle, setManualShoppingTitle] = useState("");
  const [manualShoppingCategoryId, setManualShoppingCategoryId] = useState("");
  const [manualShoppingPriority, setManualShoppingPriority] = useState<ShoppingPriority>("NORMAL");
  const [editingShoppingId, setEditingShoppingId] = useState<string | null>(null);
  const [editingShoppingTitle, setEditingShoppingTitle] = useState("");
  const [checkSession, setCheckSession] = useState<CheckSession | null>(null);
  const [pendingCheckItemName, setPendingCheckItemName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState("Загрузка...");
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [emailAuthMessage, setEmailAuthMessage] = useState<string | null>(null);
  const [devMagicLink, setDevMagicLink] = useState<string | null>(null);
  const [isRequestingMagicLink, setIsRequestingMagicLink] = useState(false);
  const [isStartingGoogleSignIn, setIsStartingGoogleSignIn] = useState(false);
  const [isStartingAppleSignIn, setIsStartingAppleSignIn] = useState(false);
  const [reminderDrafts, setReminderDrafts] = useState<Record<string, ReminderDraft>>({});
  const [savingReminderKeys, setSavingReminderKeys] = useState<string[]>([]);
  const [reminderSettingsMessage, setReminderSettingsMessage] = useState<string | null>(null);
  const [pendingActionKeys, setPendingActionKeys] = useState<string[]>([]);
  const [workspaceLoadFailed, setWorkspaceLoadFailed] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showMenuSheet, setShowMenuSheet] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notificationsViewed, setNotificationsViewed] = useState(false);

  const selectedCategory = useMemo(
    () => categories.find((category) => category.id === selectedCategoryId) ?? categories[0],
    [categories, selectedCategoryId]
  );

  const selectedGroup = useMemo(
    () => groups.find((group) => group.id === selectedGroupId) ?? groups[0],
    [groups, selectedGroupId]
  );
  const selectedGroupCheckItemCount =
    selectedGroup?.items.filter(
      (groupItem) => groupItem.item.archivedAt === null && groupItem.item.status !== "PAUSED"
    ).length ?? 0;

  const activeWorkspace = useMemo(
    () => workspaces.find((workspace) => workspace.id === activeWorkspaceId) ?? workspaces[0] ?? null,
    [activeWorkspaceId, workspaces]
  );
  const canManageActiveWorkspace = activeWorkspace?.role === "OWNER";
  const showWorkspaceSwitcher = workspaces.length > 1;
  const showShareEntryPoint = Boolean(token && (!activeWorkspace || canManageActiveWorkspace));

  const visibleItems = useMemo(
    () =>
      selectedCategory
        ? items.filter((item) => item.categoryId === selectedCategory.id)
        : [],
    [items, selectedCategory]
  );

  const visibleRecommendations = useMemo(() => {
    if (!selectedCategory || selectedCategory.id !== recommendationSourceCategoryId) {
      return [];
    }

    return recommendations;
  }, [recommendations, recommendationSourceCategoryId, selectedCategory]);

  const starterCategoryOptions = useMemo(() => {
    const names = selectedStarterCategories.length ? selectedStarterCategories : starterCategories;
    return [...new Set(names)];
  }, [selectedStarterCategories]);

  const archivedStandaloneItems = useMemo(
    () => archivedItems.filter((item) => !item.category?.archivedAt),
    [archivedItems]
  );

  const shoppingGroups = useMemo(() => {
    const groups = new Map<string, { id: string; title: string; entries: ShoppingListEntry[] }>();

    for (const entry of shoppingList) {
      const id = entry.category?.id ?? "manual";
      const title = entry.category?.name ?? "Без категории";
      const group = groups.get(id);

      if (group) {
        group.entries.push(entry);
      } else {
        groups.set(id, {
          id,
          title,
          entries: [entry]
        });
      }
    }

    return [...groups.values()];
  }, [shoppingList]);

  const currentCheckItem = useMemo(() => {
    return checkSession?.items.find((sessionItem) => !sessionItem.checkedAt) ?? null;
  }, [checkSession]);

  const checkedCount =
    checkSession?.items.filter((sessionItem) => sessionItem.checkedAt || sessionItem.selectedStatus)
      .length ?? 0;

  const attentionItemsCount = useMemo(
    () => items.filter((item) => item.status !== "IN_STOCK" && item.status !== "PAUSED").length,
    [items]
  );

  const urgentItems = useMemo(
    () => items.filter((item) => item.status === "URGENT" || item.status === "NEED_BUY").slice(0, 5),
    [items]
  );
  const notificationCount = shoppingList.length + inAppReminders.length;
  const itemReminders = useMemo(
    () => inAppReminders.filter((reminder) => reminder.entityType === "ITEM"),
    [inAppReminders]
  );
  const categoryReminders = useMemo(
    () => inAppReminders.filter((reminder) => reminder.entityType === "CATEGORY"),
    [inAppReminders]
  );
  const groupReminders = useMemo(
    () => inAppReminders.filter((reminder) => reminder.entityType === "GROUP"),
    [inAppReminders]
  );

  useEffect(() => {
    if (!toastMessage) {
      return;
    }

    const timeoutId = window.setTimeout(() => setToastMessage(null), 4000);
    return () => window.clearTimeout(timeoutId);
  }, [toastMessage]);

  useEffect(() => {
    let isMounted = true;

    async function boot() {
      try {
        const query = new URLSearchParams(window.location.search);
        if (query.has("workspace_invite_token")) {
          setLoadingMessage("Принимаем приглашение...");
        } else if (query.has("magic_token") || query.has("oauth_token")) {
          setLoadingMessage("Завершаем вход...");
        } else if (query.has("oauth_error")) {
          setLoadingMessage("Возвращаемся ко входу...");
        }

        const authToken = await login();
        if (!isMounted) {
          return;
        }

        setToken(authToken);
        const [userProfile, , activeData] = await Promise.all([
          getMe(authToken),
          refreshWorkspaces(authToken),
          refreshActiveData(authToken)
        ]);
        await refreshActiveCheckSession(authToken);
        const hasCompletedOnboardingLocally =
          window.localStorage.getItem(onboardingStorageKey) === "true";
        const hasExistingProductData =
          activeData.categories.length > 0 || activeData.items.length > 0;
        const hasCompletedOnboarding =
          Boolean(userProfile.onboardingCompletedAt) ||
          hasCompletedOnboardingLocally ||
          hasExistingProductData;

        setShowOnboarding(!hasCompletedOnboarding);
        if (hasCompletedOnboarding && !userProfile.onboardingCompletedAt) {
          void completeOnboarding(authToken).catch(() => undefined);
        }
      } catch (caughtError) {
        if (isMounted) {
          const message = formatError(caughtError);
          if (message !== "EMAIL_AUTH_REQUIRED") {
            setError(message);
          }
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void boot();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedCategoryId && categories[0]) {
      setSelectedCategoryId(categories[0].id);
    }
  }, [categories, selectedCategoryId]);

  useEffect(() => {
    if (activeTab !== "archive" || !token) {
      return;
    }

    void refreshArchivedData(token).catch((caughtError) => setError(formatError(caughtError)));
  }, [activeTab, token]);

  useEffect(() => {
    if (activeTab !== "check" || !token || checkSession?.status === "IN_PROGRESS") {
      return;
    }

    void refreshActiveCheckSession(token).catch((caughtError) => setError(formatError(caughtError)));
  }, [activeTab, checkSession?.status, token]);

  useEffect(() => {
    if (activeTab !== "settings" || !token || !activeWorkspace?.id || !canManageActiveWorkspace) {
      setWorkspaceMembers([]);
      setWorkspaceInvitations([]);
      return;
    }

    void refreshWorkspaceAccess(token, activeWorkspace.id).catch((caughtError) =>
      setError(formatError(caughtError))
    );
  }, [activeTab, activeWorkspace?.id, canManageActiveWorkspace, token]);

  useEffect(() => {
    const nextDrafts: Record<string, ReminderDraft> = {};

    for (const category of categories) {
      nextDrafts[getReminderDraftKey("CATEGORY", category.id)] = {
        usageCycleDays: String(category.usageCycleDays ?? ""),
        reminderEnabled: category.reminderEnabled
      };
    }

    for (const group of groups) {
      nextDrafts[getReminderDraftKey("GROUP", group.id)] = {
        usageCycleDays: String(group.usageCycleDays ?? ""),
        reminderEnabled: group.reminderEnabled
      };
    }

    for (const item of items) {
      nextDrafts[getReminderDraftKey("ITEM", item.id)] = {
        usageCycleDays: String(item.usageCycleDays ?? ""),
        reminderEnabled: item.reminderEnabled
      };
    }

    setReminderDrafts(nextDrafts);
  }, [categories, groups, items]);

  async function refreshActiveData(authToken = token) {
    if (!authToken) {
      return {
        categories: [],
        items: [],
        shoppingList: [],
        groups: [],
        inAppReminders: []
      };
    }

    const [
      nextCategories,
      nextItems,
      nextShoppingList,
      nextGroups,
      nextInAppReminders
    ] = await Promise.all([
      getCategories(authToken),
      getItems(authToken),
      getShoppingList(authToken),
      getGroups(authToken),
      getInAppReminders(authToken)
    ]);

    setCategories(nextCategories);
    setItems(nextItems);
    setShoppingList(nextShoppingList);
    setGroups(nextGroups);
    setInAppReminders(nextInAppReminders);

    return {
      categories: nextCategories,
      items: nextItems,
      shoppingList: nextShoppingList,
      groups: nextGroups,
      inAppReminders: nextInAppReminders
    };
  }

  async function refreshWorkspaces(authToken = token) {
    if (!authToken) {
      return [];
    }

    const nextWorkspaces = await getWorkspaces(authToken).catch((caughtError) => {
      if (!isNotFoundError(caughtError)) {
        throw caughtError;
      }

      clearActiveWorkspaceId();
      setWorkspaces([]);
      setActiveWorkspaceIdState(null);
      setWorkspaceLoadFailed(true);
      return [];
    });
    const savedWorkspaceId = getActiveWorkspaceId();
    const nextActiveWorkspace =
      nextWorkspaces.find((workspace) => workspace.id === savedWorkspaceId) ?? nextWorkspaces[0];

    setWorkspaceLoadFailed(false);
    setWorkspaces(nextWorkspaces);
    setActiveWorkspaceIdState(nextActiveWorkspace?.id ?? null);
    if (nextActiveWorkspace) {
      setActiveWorkspaceId(nextActiveWorkspace.id);
    } else {
      clearActiveWorkspaceId();
    }

    return nextWorkspaces;
  }

  async function handleRetryWorkspaceLoad() {
    if (!token) {
      return;
    }

    setError(null);
    setWorkspaceMessage(null);
    setDevInvitationLink(null);
    await refreshWorkspaces(token);
  }

  async function refreshWorkspaceAccess(authToken = token, workspaceId = activeWorkspaceId) {
    if (!authToken || !workspaceId) {
      return;
    }

    setIsLoadingWorkspaceAccess(true);
    try {
      const response = await getWorkspaceInvitations(authToken, workspaceId);
      setWorkspaceMembers(response.members);
      setWorkspaceInvitations(response.invitations);
      setWorkspaceLoadFailed(false);
    } catch (caughtError) {
      setWorkspaceMembers([]);
      setWorkspaceInvitations([]);
      setWorkspaceLoadFailed(true);
      throw caughtError;
    } finally {
      setIsLoadingWorkspaceAccess(false);
    }
  }

  async function refreshArchivedData(authToken = token) {
    if (!authToken) {
      return;
    }

    const [nextArchivedCategories, nextArchivedItems] = await Promise.all([
      getArchivedCategories(authToken),
      getArchivedItems(authToken)
    ]);

    setArchivedCategories(nextArchivedCategories);
    setArchivedItems(nextArchivedItems);
  }

  async function refreshActiveCheckSession(authToken = token) {
    if (!authToken) {
      return;
    }

    const session = await getActiveCheckSession(authToken);
    if (!session) {
      return;
    }

    setCheckSession(session);
    if (session.categoryId) {
      setSelectedCategoryId(session.categoryId);
    }

    if (session.groupId) {
      setSelectedGroupId(session.groupId);
    }
  }

  async function refreshRecommendations(authToken: string, item: Item) {
    const nextRecommendations = await getRecommendations(authToken, item.id);
    setRecommendations(nextRecommendations);
    setRecommendationSourceItemName(nextRecommendations.length ? item.name : null);
    setRecommendationSourceCategoryId(nextRecommendations.length ? item.categoryId : null);
  }

  async function handleCreateCategory() {
    if (!token || !categoryName.trim()) {
      return;
    }

    const actionKey = "category:create";
    try {
      setError(null);
      setPendingAction(actionKey, true);
      const category = await createCategory(token, categoryName.trim());
      setCategoryName("");
      setShowCategoryForm(false);
      setCategories((current) => [...current, category]);
      setSelectedCategoryId(category.id);
    } finally {
      setPendingAction(actionKey, false);
    }
  }

  async function handleCreateItem() {
    if (!token || !selectedCategory || !itemName.trim()) {
      return;
    }

    const actionKey = "item:create";
    try {
      setError(null);
      setPendingAction(actionKey, true);
      const item = await createItem(token, {
        categoryId: selectedCategory.id,
        name: itemName.trim()
      });
      setItemName("");
      setItems((current) => [...current, item]);
      await refreshActiveData(token);
      await refreshRecommendations(token, item);
    } finally {
      setPendingAction(actionKey, false);
    }
  }

  async function handleSetStatus(item: Item, status: ItemStatus) {
    if (!token) {
      return;
    }

    const actionKey = `item:status:${item.id}`;
    try {
      setError(null);
      setPendingAction(actionKey, true);
      const updatedItem = await setItemStatus(token, item.id, status);
      setItems((current) =>
        current.map((currentItem) =>
          currentItem.id === updatedItem.id ? updatedItem : currentItem
        )
      );
      await refreshActiveData(token);
      await refreshRecommendations(token, updatedItem);
      if (status === "IN_STOCK" && item.status !== "IN_STOCK") {
        showBoughtToast(item.name);
      }
    } finally {
      setPendingAction(actionKey, false);
    }
  }

  async function handleAcceptRecommendation(recommendation: RecommendationSuggestion) {
    if (!token) {
      return;
    }

    if (!window.confirm(`Добавить "${recommendation.suggestedItem}"?`)) {
      return;
    }

    const actionKey = `recommendation:add:${recommendation.id}`;
    try {
      setError(null);
      setPendingAction(actionKey, true);
      const item = await acceptRecommendation(token, recommendation.id);
      await refreshActiveData(token);
      await refreshRecommendations(token, item);
    } finally {
      setPendingAction(actionKey, false);
    }
  }

  async function handleDismissRecommendation(recommendation: RecommendationSuggestion) {
    if (!token) {
      return;
    }

    setError(null);
    await dismissRecommendation(token, recommendation.id);
    setRecommendations((current) =>
      current.filter((currentRecommendation) => currentRecommendation.id !== recommendation.id)
    );
    if (recommendations.length <= 1) {
      setRecommendationSourceItemName(null);
      setRecommendationSourceCategoryId(null);
    }
  }

  async function handleHideSimilarRecommendations(recommendation: RecommendationSuggestion) {
    if (!token) {
      return;
    }

    setError(null);
    const result = await hideSimilarRecommendations(token, recommendation.id);
    const hasRemainingRecommendations = recommendations.some(
      (currentRecommendation) => currentRecommendation.ruleId !== result.ruleId
    );
    setRecommendations((current) =>
      current.filter((currentRecommendation) => currentRecommendation.ruleId !== result.ruleId)
    );
    if (!hasRemainingRecommendations) {
      setRecommendationSourceItemName(null);
      setRecommendationSourceCategoryId(null);
    }
  }

  async function handleCompleteShoppingListItem(entry: ShoppingListEntry) {
    if (!token) {
      return;
    }

    const actionKey = `shopping:bought:${entry.id}`;
    try {
      setError(null);
      setPendingAction(actionKey, true);
      const completedEntry = await completeShoppingListItem(token, entry.id);
      await refreshActiveData(token);
      if (completedEntry.item) {
        await refreshRecommendations(token, completedEntry.item);
      }
      showBoughtToast(entry.title);
    } finally {
      setPendingAction(actionKey, false);
    }
  }

  async function handleCreateManualShoppingItem() {
    if (!token || !manualShoppingTitle.trim()) {
      return;
    }

    const actionKey = "shopping:add";
    try {
      setError(null);
      setPendingAction(actionKey, true);
      await createShoppingListItem(token, {
        title: manualShoppingTitle.trim(),
        categoryId: manualShoppingCategoryId || null,
        priority: manualShoppingPriority
      });
      setManualShoppingTitle("");
      setManualShoppingCategoryId("");
      setManualShoppingPriority("NORMAL");
      await refreshActiveData(token);
    } finally {
      setPendingAction(actionKey, false);
    }
  }

  async function handleUpdateManualShoppingItem(entry: ShoppingListEntry) {
    if (!token || !editingShoppingTitle.trim()) {
      return;
    }

    setError(null);
    await updateShoppingListItem(token, entry.id, {
      title: editingShoppingTitle.trim(),
      categoryId: entry.categoryId,
      priority: entry.priority
    });
    setEditingShoppingId(null);
    setEditingShoppingTitle("");
    await refreshActiveData(token);
  }

  async function handleDeleteManualShoppingItem(entry: ShoppingListEntry) {
    if (!token || !window.confirm(`Удалить "${entry.title}" из списка покупок?`)) {
      return;
    }

    setError(null);
    await deleteShoppingListItem(token, entry.id);
    await refreshActiveData(token);
  }

  async function handleUpdateItem(item: Item) {
    if (!token || !editingItemName.trim()) {
      return;
    }

    setError(null);
    const updatedItem = await updateItem(token, item.id, {
      name: editingItemName.trim()
    });
    setItems((current) =>
      current.map((currentItem) => (currentItem.id === updatedItem.id ? updatedItem : currentItem))
    );
    setEditingItemId(null);
    setEditingItemName("");
    await refreshActiveData(token);
  }

  function updateReminderDraft(key: string, draft: ReminderDraft) {
    setReminderDrafts((current) => ({
      ...current,
      [key]: draft
    }));
    setReminderSettingsMessage(null);
  }

  function parseReminderCycleDays(draft: ReminderDraft): number | null {
    const trimmedDays = draft.usageCycleDays.trim();
    const usageCycleDays = trimmedDays ? Number(trimmedDays) : null;
    if (usageCycleDays !== null && (!Number.isInteger(usageCycleDays) || usageCycleDays <= 0)) {
      throw new Error("Цикл проверки должен быть целым числом дней.");
    }

    return usageCycleDays;
  }

  function setReminderSaving(key: string, isSaving: boolean) {
    setSavingReminderKeys((current) => {
      if (isSaving) {
        return current.includes(key) ? current : [...current, key];
      }

      return current.filter((currentKey) => currentKey !== key);
    });
  }

  function setPendingAction(key: string, isPending: boolean) {
    setPendingActionKeys((current) => {
      if (isPending) {
        return current.includes(key) ? current : [...current, key];
      }

      return current.filter((currentKey) => currentKey !== key);
    });
  }

  function showBoughtToast(title: string) {
    setToastMessage(`${title} отмечено купленным`);
  }

  function isActionPending(key: string): boolean {
    return pendingActionKeys.includes(key);
  }

  async function handleSaveReminderSettingsGroup(
    entityType: InAppReminder["entityType"],
    entityIds: string[]
  ) {
    if (!token) {
      return;
    }

    if (!entityIds.length) {
      return;
    }

    const groupKey = `${entityType}:SECTION`;
    try {
      setError(null);
      setReminderSettingsMessage(null);
      setReminderSaving(groupKey, true);
      await Promise.all(
        entityIds.map((entityId) => {
          const draft = reminderDrafts[getReminderDraftKey(entityType, entityId)];
          if (!draft) {
            return Promise.resolve(null);
          }

          const input = {
            usageCycleDays: parseReminderCycleDays(draft),
            reminderEnabled: draft.reminderEnabled
          };

          if (entityType === "CATEGORY") {
            return updateCategory(token, entityId, input);
          }

          if (entityType === "GROUP") {
            return updateGroup(token, entityId, input);
          }

          return updateItem(token, entityId, input);
        })
      );

      await refreshActiveData(token);
      setReminderSettingsMessage(
        entityType === "CATEGORY"
          ? "Настройки категорий сохранены."
          : entityType === "ITEM"
            ? "Настройки товаров сохранены."
            : "Настройки наборов сохранены."
      );
    } catch (caughtError) {
      setError(formatError(caughtError));
    } finally {
      setReminderSaving(groupKey, false);
    }
  }

  function handleOpenReminder(reminder: InAppReminder) {
    if (reminder.entityType === "CATEGORY") {
      setSelectedCategoryId(reminder.entityId);
      setActiveTab("items");
      return;
    }

    if (reminder.entityType === "GROUP") {
      setSelectedGroupId(reminder.entityId);
      setActiveTab("groups");
      return;
    }

    const item = items.find((candidate) => candidate.id === reminder.entityId);
    if (item) {
      setSelectedCategoryId(item.categoryId);
      setActiveTab("items");
    }
  }

  async function handleSnoozeReminder(reminder: InAppReminder, days = reminderSnoozeDays) {
    if (!token) {
      return;
    }

    const actionKey = `reminder:snooze:${reminder.id}`;
    try {
      setError(null);
      setPendingAction(actionKey, true);
      if (reminder.entityType === "ITEM") {
        await snoozeItemReminder(token, reminder.entityId, days);
      } else if (reminder.entityType === "CATEGORY") {
        await updateCategory(token, reminder.entityId, {
          nextCheckAt: calculateSnoozedAt(days)
        });
      } else {
        await updateGroup(token, reminder.entityId, {
          nextCheckAt: calculateSnoozedAt(days)
        });
      }

      await refreshActiveData(token);
    } finally {
      setPendingAction(actionKey, false);
    }
  }

  async function handleStartReminderCheck(reminder: InAppReminder) {
    if (!token) {
      return;
    }

    setError(null);
    if (reminder.entityType === "CATEGORY") {
      const session = await startCategoryCheckSession(token, reminder.entityId);
      setSelectedCategoryId(reminder.entityId);
      setCheckSession(session);
      setActiveTab("check");
      return;
    }

    if (reminder.entityType === "GROUP") {
      const session = await startGroupCheckSession(token, reminder.entityId);
      setSelectedGroupId(reminder.entityId);
      setCheckSession(session);
      setActiveTab("check");
    }
  }

  function renderReminderActions(reminder: InAppReminder) {
    return (
      <div className="reminder-actions">
        {reminder.entityType !== "ITEM" ? (
          <button
            className="primary-light-button"
            type="button"
            onClick={() =>
              void handleStartReminderCheck(reminder).catch((caughtError) =>
                setError(formatError(caughtError))
              )
            }
          >
            Проверить
          </button>
        ) : null}
        <button
          className="ghost-button"
          type="button"
          disabled={isActionPending(`reminder:snooze:${reminder.id}`)}
          onClick={() =>
            void handleSnoozeReminder(reminder).catch((caughtError) =>
              setError(formatError(caughtError))
            )
          }
        >
          {isActionPending(`reminder:snooze:${reminder.id}`) ? "Откладываем..." : "Отложить"}
        </button>
        <button className="ghost-button" type="button" onClick={() => handleOpenReminder(reminder)}>
          Подробнее
        </button>
      </div>
    );
  }

  function renderReminderList(reminders: InAppReminder[]) {
    return (
      <div className="item-list">
        {reminders.map((reminder) => (
          <article className="shopping-row reminder-row" key={reminder.id}>
            <div>
              <span className={reminder.timing === "DUE" ? "badge badge-urgent" : "badge badge-muted"}>
                {reminder.timing === "DUE" ? "Пора проверить" : "Скоро"} ·{" "}
                {formatDate(reminder.nextCheckAt)}
              </span>
              <h2>{reminder.title}</h2>
              <span className="metadata-text">{reminderEntityLabels[reminder.entityType]}</span>
            </div>
            {renderReminderActions(reminder)}
          </article>
        ))}
      </div>
    );
  }

  async function handleArchiveItem(item: Item) {
    if (!token || !window.confirm(`Архивировать "${item.name}"?`)) {
      return;
    }

    setError(null);
    await archiveItem(token, item.id);
    await refreshActiveData(token);
    if (activeTab === "archive") {
      await refreshArchivedData(token);
    }
  }

  async function handleArchiveSelectedCategory() {
    if (!token || !selectedCategory) {
      return;
    }

    if (!window.confirm(`Архивировать категорию "${selectedCategory.name}" и ее товары?`)) {
      return;
    }

    setError(null);
    await archiveCategory(token, selectedCategory.id);
    setSelectedCategoryId(null);
    await refreshActiveData(token);
    if (activeTab === "archive") {
      await refreshArchivedData(token);
    }
  }

  async function handleRestoreCategory(category: Category) {
    if (!token) {
      return;
    }

    setError(null);
    const restoredCategory = await restoreCategory(token, category.id);
    setSelectedCategoryId(restoredCategory.id);
    setActiveTab("items");
    await refreshActiveData(token);
  }

  async function handleRestoreItem(item: Item) {
    if (!token) {
      return;
    }

    setError(null);
    const restoredItem = await restoreItem(token, item.id);
    setSelectedCategoryId(restoredItem.categoryId);
    setActiveTab("items");
    await refreshActiveData(token);
  }

  async function handleDeleteArchivedCategory(category: Category) {
    if (!token || !window.confirm(`Удалить категорию "${category.name}" из архива навсегда?`)) {
      return;
    }

    setError(null);
    await deleteArchivedCategory(token, category.id);
    await refreshArchivedData(token);
  }

  async function handleDeleteArchivedItem(item: Item) {
    if (!token || !window.confirm(`Удалить товар "${item.name}" из архива навсегда?`)) {
      return;
    }

    setError(null);
    await deleteArchivedItem(token, item.id);
    await refreshArchivedData(token);
  }

  async function handleClearCompletedShoppingList() {
    if (!token) {
      return;
    }

    setError(null);
    await clearCompletedShoppingList(token);
    await refreshActiveData(token);
  }

  async function handleStartCategoryCheck() {
    if (!token || !selectedCategory) {
      return;
    }

    setError(null);
    if (selectedCategory.itemCount === 0) {
      setError("В этой категории пока нечего проверять.");
      return;
    }

    const session = await startCategoryCheckSession(token, selectedCategory.id);
    setCheckSession(session);
    setActiveTab("check");
  }

  async function handleCreateGroup() {
    if (!token || !groupName.trim()) {
      return;
    }

    const actionKey = "group:create";
    try {
      setError(null);
      setPendingAction(actionKey, true);
      const group = await createGroup(token, groupName.trim());
      setGroupName("");
      setGroups((current) => [...current, group]);
      setSelectedGroupId(group.id);
    } finally {
      setPendingAction(actionKey, false);
    }
  }

  async function handleArchiveSelectedGroup() {
    if (!token || !selectedGroup || !window.confirm(`Архивировать набор "${selectedGroup.name}"?`)) {
      return;
    }

    setError(null);
    await archiveGroup(token, selectedGroup.id);
    setSelectedGroupId(null);
    await refreshActiveData(token);
  }

  async function handleAddGroupItem() {
    if (!token || !selectedGroup || !groupItemId) {
      return;
    }

    const actionKey = "group:item:add";
    try {
      setError(null);
      setPendingAction(actionKey, true);
      const group = await addGroupItem(token, selectedGroup.id, groupItemId);
      setGroups((current) =>
        current.map((itemGroup) => (itemGroup.id === group.id ? group : itemGroup))
      );
      setGroupItemId("");
    } finally {
      setPendingAction(actionKey, false);
    }
  }

  async function handleRemoveGroupItem(itemId: string) {
    if (!token || !selectedGroup) {
      return;
    }

    setError(null);
    const group = await removeGroupItem(token, selectedGroup.id, itemId);
    setGroups((current) => current.map((itemGroup) => (itemGroup.id === group.id ? group : itemGroup)));
  }

  async function handleStartGroupCheck() {
    if (!token || !selectedGroup) {
      return;
    }

    setError(null);
    if (selectedGroupCheckItemCount === 0) {
      setError("В этом наборе пока нечего проверять.");
      return;
    }

    const session = await startGroupCheckSession(token, selectedGroup.id);
    setCheckSession(session);
    setActiveTab("check");
  }

  async function handleCheckStatus(status: ItemStatus) {
    if (!token || !checkSession || !currentCheckItem || pendingCheckItemName) {
      return;
    }

    setError(null);
    const checkedItem = currentCheckItem;
    setPendingCheckItemName(checkedItem.item.name);

    try {
      const session = await setCheckSessionItemStatus(
        token,
        checkSession.id,
        checkedItem.itemId,
        status
      );

      if (session.items.every((sessionItem) => sessionItem.checkedAt || sessionItem.selectedStatus)) {
        const completedSession = await completeCheckSession(token, session.id);
        setCheckSession(completedSession);
      } else {
        setCheckSession(session);
      }

      void refreshActiveData(token).catch((caughtError) => setError(formatError(caughtError)));
    } catch (caughtError) {
      setError(formatError(caughtError));
    } finally {
      setPendingCheckItemName(null);
    }
  }

  async function handleCancelCheck() {
    if (!token || !checkSession) {
      return;
    }

    setError(null);
    const session = await cancelCheckSession(token, checkSession.id);
    setCheckSession(session);
  }

  async function handleFinishOnboarding(skipSetup = false) {
    if (!token) {
      return;
    }

    setError(null);
    if (!skipSetup) {
      const existingCategoryNames = new Set(categories.map((category) => category.name));
      const starterItemDrafts = starterItems
        .map((item) => ({
          name: item.name.trim(),
          categoryName: starterCategoryOptions.includes(item.categoryName.trim())
            ? item.categoryName.trim()
            : starterCategoryOptions[0] ?? ""
        }))
        .filter((item) => item.name && item.categoryName)
        .slice(0, 5);
      const requestedCategoryNames = [
        ...selectedStarterCategories,
        ...starterItemDrafts.map((item) => item.categoryName)
      ];
      const createdCategories: Category[] = [];

      for (const name of [...new Set(requestedCategoryNames)]) {
        if (!existingCategoryNames.has(name)) {
          const category = await createCategory(token, name);
          createdCategories.push(category);
          existingCategoryNames.add(name);
        }
      }

      const nextCategories = createdCategories.length
        ? [...categories, ...createdCategories]
        : categories;
      const categoriesByName = new Map(nextCategories.map((category) => [category.name, category]));

      for (const item of starterItemDrafts) {
        const category = categoriesByName.get(item.categoryName);
        if (category) {
          await createItem(token, {
            categoryId: category.id,
            name: item.name
          });
        }
      }
    }

    await completeOnboarding(token);
    window.localStorage.setItem(onboardingStorageKey, "true");
    setShowOnboarding(false);
    setOnboardingStep(0);
    await refreshActiveData(token);
    setActiveTab("home");
  }

  async function handleSearchItems() {
    if (!token || !searchQuery.trim()) {
      return;
    }

    setError(null);
    const results = await searchItems(token, searchQuery.trim());
    setSearchResults(results);
    setHasSearched(true);
    setActiveTab("search");
  }

  function clearSearchSession() {
    setSearchQuery("");
    setSearchResults([]);
    setHasSearched(false);
  }

  function clearWorkspaceScopedState() {
    setCategories([]);
    setItems([]);
    setArchivedCategories([]);
    setArchivedItems([]);
    setGroups([]);
    setShoppingList([]);
    setInAppReminders([]);
    setRecommendations([]);
    setRecommendationSourceItemName(null);
    setRecommendationSourceCategoryId(null);
    setSelectedCategoryId(null);
    setSelectedGroupId(null);
    setCheckSession(null);
    setPendingCheckItemName(null);
    clearSearchSession();
  }

  function handleSelectTab(tab: ActiveTab) {
    if (tab !== "search") {
      clearSearchSession();
    }

    setActiveTab(tab);
  }

  function handleSelectMenuTab(tab: ActiveTab) {
    handleSelectTab(tab);
    setShowMenuSheet(false);
  }

  function handleBellClick() {
    setShowMenuSheet(false);
    setNotificationsViewed(true);
    setShowNotifications((current) => !current);
  }

  useEffect(() => {
    if (!showNotifications) {
      return;
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setShowNotifications(false);
      }
    }

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [showNotifications]);

  useEffect(() => {
    if (!showMenuSheet) {
      return;
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setShowMenuSheet(false);
      }
    }

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [showMenuSheet]);

  function handleSelectCategory(categoryId: string) {
    clearSearchSession();
    setSelectedCategoryId(categoryId);
    setActiveTab("items");
  }

  async function handleSelectWorkspace(workspaceId: string) {
    if (!token || workspaceId === activeWorkspaceId) {
      return;
    }

    setError(null);
    setWorkspaceMessage(null);
    setDevInvitationLink(null);
    setActiveWorkspaceId(workspaceId);
    setActiveWorkspaceIdState(workspaceId);
    setWorkspaceMembers([]);
    setWorkspaceInvitations([]);
    clearWorkspaceScopedState();
    await refreshActiveData(token);
    await refreshActiveCheckSession(token);
    if (activeTab === "archive") {
      await refreshArchivedData(token);
    }
  }

  async function handleCreateWorkspaceInvitation() {
    if (!token || !activeWorkspace || !workspaceInviteEmail.trim()) {
      return;
    }

    setError(null);
    setWorkspaceMessage(null);
    setDevInvitationLink(null);
    setWorkspaceAction("invite");
    try {
      const response = await createWorkspaceInvitation(
        token,
        activeWorkspace.id,
        workspaceInviteEmail.trim()
      );
      setWorkspaceInviteEmail("");
      setWorkspaceMessage(
        response.sent
          ? `Доступ к списку отправлен на ${response.invitation.email}.`
          : `Приглашение для ${response.invitation.email} создано, но письмо не удалось отправить. Попробуйте отправить приглашение еще раз позже.`
      );
      setDevInvitationLink(response.devInvitationLink ?? null);
      await refreshWorkspaceAccess(token, activeWorkspace.id);
    } finally {
      setWorkspaceAction(null);
    }
  }

  async function handleRevokeWorkspaceInvitation(invitation: WorkspaceInvitation) {
    if (!token || !window.confirm(`Отозвать приглашение для ${invitation.email}?`)) {
      return;
    }

    setError(null);
    setWorkspaceMessage(null);
    setDevInvitationLink(null);
    setWorkspaceAction(`revoke:${invitation.id}`);
    try {
      await revokeWorkspaceInvitation(token, invitation.id);
      setWorkspaceMessage(`Приглашение для ${invitation.email} отозвано.`);
      if (activeWorkspace) {
        await refreshWorkspaceAccess(token, activeWorkspace.id);
      }
    } finally {
      setWorkspaceAction(null);
    }
  }

  async function handleRemoveWorkspaceMember(member: WorkspaceMember) {
    if (!token || !activeWorkspace) {
      return;
    }

    const memberName = formatWorkspaceMemberName(member);
    if (!window.confirm(`Удалить доступ для ${memberName}?`)) {
      return;
    }

    setError(null);
    setWorkspaceMessage(null);
    setDevInvitationLink(null);
    setWorkspaceAction(`remove:${member.id}`);
    try {
      await removeWorkspaceMember(token, activeWorkspace.id, member.id);
      setWorkspaceMessage(`Доступ для ${memberName} удален.`);
      await refreshWorkspaces(token);
      await refreshWorkspaceAccess(token, activeWorkspace.id);
    } finally {
      setWorkspaceAction(null);
    }
  }

  async function handleTransferWorkspaceOwnership(member: WorkspaceMember) {
    if (!token || !activeWorkspace) {
      return;
    }

    const memberName = formatWorkspaceMemberName(member);
    if (!window.confirm(`Передать владение списком "${activeWorkspace.name}" пользователю ${memberName}?`)) {
      return;
    }

    setError(null);
    setWorkspaceMessage(null);
    setDevInvitationLink(null);
    setWorkspaceAction("transfer");
    try {
      await transferWorkspaceOwnership(token, activeWorkspace.id, member.id);
      setWorkspaceMessage(`${memberName} теперь владелец списка "${activeWorkspace.name}".`);
      await refreshWorkspaces(token);
      await refreshActiveData(token);
    } finally {
      setWorkspaceAction(null);
    }
  }

  async function handleExportUserData() {
    if (!token) {
      return;
    }

    setError(null);
    const payload = await exportUserData(token);
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json"
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `kupitnezabyt-export-${payload.exportedAt.slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function handleDeleteAccount() {
    if (!token) {
      return;
    }

    if (
      !window.confirm(
        "Удалить аккаунт и все данные? Это действие нельзя отменить."
      )
    ) {
      return;
    }

    setError(null);
    await deleteAccount(token);
    resetClientSession({ clearOnboarding: true });
  }

  function handleSignOut() {
    resetClientSession();
  }

  function resetClientSession(options: { clearOnboarding?: boolean } = {}) {
    clearSavedToken();
    setToken(null);
    setCategories([]);
    setItems([]);
    setGroups([]);
    setShoppingList([]);
    setRecommendations([]);
    setRecommendationSourceItemName(null);
    setRecommendationSourceCategoryId(null);
    setSearchResults([]);
    setHasSearched(false);
    setWorkspaces([]);
    setActiveWorkspaceIdState(null);
    setWorkspaceMembers([]);
    setWorkspaceInvitations([]);
    setWorkspaceLoadFailed(false);
    setShowOnboarding(false);
    setOnboardingStep(0);
    if (options.clearOnboarding) {
      window.localStorage.removeItem(onboardingStorageKey);
    }
    setActiveTab("home");
  }

  async function handleRequestMagicLink() {
    if (!email.trim()) {
      setError("Введите email.");
      return;
    }

    setError(null);
    setEmailAuthMessage(null);
    setDevMagicLink(null);
    setIsRequestingMagicLink(true);

    try {
      const response = await requestMagicLink(email.trim());
      if (response.sent) {
        setEmailAuthMessage("Письмо для входа отправлено. Откройте ссылку в этом браузере.");
        setDevMagicLink(response.devMagicLink ?? null);
      }
    } finally {
      setIsRequestingMagicLink(false);
    }
  }

  async function handleStartGoogleSignIn() {
    setError(null);
    setEmailAuthMessage(null);
    setDevMagicLink(null);
    setIsStartingGoogleSignIn(true);

    try {
      const response = await startGoogleSignIn();
      window.location.assign(response.authUrl);
    } finally {
      setIsStartingGoogleSignIn(false);
    }
  }

  async function handleStartAppleSignIn() {
    setError(null);
    setEmailAuthMessage(null);
    setDevMagicLink(null);
    setIsStartingAppleSignIn(true);

    try {
      const response = await startAppleSignIn();
      window.location.assign(response.authUrl);
    } finally {
      setIsStartingAppleSignIn(false);
    }
  }

  if (isLoading) {
    return <main className="app-shell centered">{loadingMessage}</main>;
  }

  if (!token) {
    return (
      <main className="app-shell onboarding-shell">
        <ErrorNotice message={error} onClose={() => setError(null)} />
        <section className="onboarding-panel">
          <div className="login-heading">
            <div className="brand-lockup brand-lockup-large">
              <img alt="" className="brand-logo" src="/logo.png" />
              <div>
                <p className="eyebrow">Вход</p>
                <h1>
                  <BrandWord />
                </h1>
              </div>
            </div>
            <p>Войдите один раз, чтобы ваши товары, проверки и покупки были под рукой.</p>
          </div>
          <button
            className="provider-button"
            type="button"
            disabled={isStartingGoogleSignIn || isStartingAppleSignIn || isRequestingMagicLink}
            onClick={() =>
              void handleStartGoogleSignIn().catch((caughtError) =>
                setError(formatError(caughtError))
              )
            }
          >
            <span aria-hidden="true">G</span>
            {isStartingGoogleSignIn ? "Открываем Google..." : "Войти через Google"}
          </button>
          <button
            className="provider-button apple-button"
            type="button"
            disabled={isStartingGoogleSignIn || isStartingAppleSignIn || isRequestingMagicLink}
            onClick={() =>
              void handleStartAppleSignIn().catch((caughtError) =>
                setError(formatError(caughtError))
              )
            }
          >
            <span aria-hidden="true"></span>
            {isStartingAppleSignIn ? "Открываем Apple..." : "Войти через Apple"}
          </button>
          <div className="auth-divider">
            <span />
            <p className="eyebrow">или email</p>
            <span />
          </div>
          <div className="email-auth-box">
            <input
              aria-label="Email"
              autoComplete="email"
              disabled={isStartingGoogleSignIn || isStartingAppleSignIn || isRequestingMagicLink}
              inputMode="email"
              placeholder="you@example.com"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            <button
              className="ghost-button auth-action"
              type="button"
              disabled={isStartingGoogleSignIn || isStartingAppleSignIn || isRequestingMagicLink}
              onClick={() =>
                void handleRequestMagicLink().catch((caughtError) =>
                  setError(formatError(caughtError))
                )
              }
            >
              <Mail aria-hidden="true" size={18} />
              {isRequestingMagicLink ? "Отправляем..." : "Получить ссылку"}
            </button>
          </div>
          {emailAuthMessage ? <p className="auth-success">{emailAuthMessage}</p> : null}
          {devMagicLink ? (
            <a className="dev-magic-link" href={devMagicLink}>
              Открыть dev magic link
            </a>
          ) : null}
        </section>
      </main>
    );
  }

  if (showOnboarding) {
    return (
      <main className="app-shell onboarding-shell">
        <ErrorNotice message={error} onClose={() => setError(null)} />
        <section className="onboarding-panel">
          <p className="eyebrow">Шаг {onboardingStep + 1} из 4</p>

          {onboardingStep === 0 ? (
            <>
              <div className="brand-lockup brand-lockup-large">
                <img alt="" className="brand-logo" src="/logo.png" />
                <h1>
                  <BrandWord />
                </h1>
              </div>
              <p>
                Помогает помнить о товарах, которые регулярно заканчиваются:
                еда, аптека, косметика, дом и другое.
              </p>
              <button type="button" onClick={() => setOnboardingStep(1)}>
                Начать
              </button>
            </>
          ) : onboardingStep === 1 ? (
            <>
              <h1>Стартовые категории</h1>
              <p>Выберите несколько областей, с которых удобно начать.</p>
              <div className="choice-grid">
                {starterCategories.map((name) => {
                  const isSelected = selectedStarterCategories.includes(name);
                  return (
                    <button
                      className={isSelected ? "choice active" : "choice"}
                      key={name}
                      type="button"
                      onClick={() =>
                        setSelectedStarterCategories((current) =>
                          isSelected
                            ? current.filter((categoryName) => categoryName !== name)
                            : [...current, name]
                        )
                      }
                    >
                      {name}
                    </button>
                  );
                })}
              </div>
              <div className="onboarding-actions">
                <button type="button" onClick={() => setOnboardingStep(2)}>
                  Продолжить
                </button>
                <button
                  className="ghost-button"
                  type="button"
                  onClick={() => {
                    setSelectedStarterCategories([]);
                    setOnboardingStep(2);
                  }}
                >
                  Пропустить
                </button>
              </div>
            </>
          ) : onboardingStep === 2 ? (
            <>
              <h1>Первые товары</h1>
              <p>Добавьте 3-5 вещей и выберите категорию для каждой.</p>
              <div className="starter-items">
                {starterItems.map((value, index) => (
                  <div className="starter-item-row" key={index}>
                    <input
                      aria-label={`Стартовый товар ${index + 1}`}
                      placeholder={starterItemHints[index] ?? "Товар"}
                      value={value.name}
                      onChange={(event) =>
                        setStarterItems((current) =>
                          current.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, name: event.target.value } : item
                          )
                        )
                      }
                    />
                    <select
                      aria-label={`Категория для товара ${index + 1}`}
                      value={
                        starterCategoryOptions.includes(value.categoryName)
                          ? value.categoryName
                          : starterCategoryOptions[0]
                      }
                      onChange={(event) =>
                        setStarterItems((current) =>
                          current.map((item, itemIndex) =>
                            itemIndex === index
                              ? { ...item, categoryName: event.target.value }
                              : item
                          )
                        )
                      }
                    >
                      {starterCategoryOptions.map((categoryName) => (
                        <option key={categoryName} value={categoryName}>
                          {categoryName}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
              <div className="onboarding-actions">
                <button type="button" onClick={() => setOnboardingStep(3)}>
                  Продолжить
                </button>
                <button
                  className="ghost-button"
                  type="button"
                  onClick={() => {
                    setStarterItems([]);
                    setOnboardingStep(3);
                  }}
                >
                  Пропустить
                </button>
              </div>
            </>
          ) : (
            <>
              <h1>Напоминания</h1>
              <p>
                Я буду показывать напоминания внутри приложения, когда пора
                проверить запасы.
              </p>
              <div className="onboarding-actions">
                <button
                  type="button"
                  onClick={() =>
                    void handleFinishOnboarding().catch((caughtError) =>
                      setError(formatError(caughtError))
                    )
                  }
                >
                  Готово
                </button>
                <button
                  className="ghost-button"
                  type="button"
                  onClick={() =>
                    void handleFinishOnboarding().catch((caughtError) =>
                      setError(formatError(caughtError))
                    )
                  }
                >
                  Пропустить напоминания
                </button>
              </div>
            </>
          )}
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <img alt="" className="brand-logo" src="/logo.png" />
          <h1>
            <BrandWord />
          </h1>
        </div>
        <form
          className="global-search"
          role="search"
          onSubmit={(event) => {
            event.preventDefault();
            void handleSearchItems().catch((caughtError) => setError(formatError(caughtError)));
          }}
        >
          <input
            aria-label="Глобальный поиск"
            placeholder="Найти товар или категорию"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
          />
          <button type="submit" aria-label="Искать">
            <Search aria-hidden="true" size={18} />
          </button>
        </form>
        <button
          aria-controls="notification-sheet"
          aria-expanded={showNotifications}
          aria-label={
            notificationCount && !notificationsViewed
              ? `Уведомлений: ${notificationCount}`
              : "Уведомления: нет новых"
          }
          className="notification-bell"
          type="button"
          onClick={handleBellClick}
        >
          <Bell aria-hidden="true" size={20} />
          {!notificationsViewed && notificationCount ? (
            <span className="notification-badge">{notificationCount}</span>
          ) : null}
        </button>
      </header>

      <ErrorNotice message={error} onClose={() => setError(null)} />
      <ToastNotice message={toastMessage} onClose={() => setToastMessage(null)} />

      <div className="main-content">
      {activeTab === "home" ? (
        <section className="stack">
          <div className="home-summary">
            <button
              className={
                attentionItemsCount ? "home-tile home-tile-attention" : "home-tile home-tile-ok"
              }
              type="button"
              onClick={() => handleSelectTab("items")}
            >
              <span className="eyebrow">Запасы</span>
              {attentionItemsCount ? (
                <>
                  <strong>{attentionItemsCount}</strong>
                  <span>требуют внимания</span>
                </>
              ) : (
                <>
                  <strong>Все запасы в порядке</strong>
                  <span>
                    {items.length ? `${items.length} отслеживается` : "Добавьте первые товары"}
                  </span>
                </>
              )}
            </button>
          </div>

          {checkSession?.status === "IN_PROGRESS" ? (
            <section className="home-section">
              <article className="shopping-row">
                <div>
                  <p className="normal">Незавершенная проверка</p>
                  <h2>{checkSession.category?.name ?? checkSession.group?.name ?? "Проверка"}</h2>
                  <span>
                    {checkedCount} из {checkSession.items.length}
                  </span>
                </div>
                <button
                  className="ghost-button"
                  type="button"
                  onClick={() => setActiveTab("check")}
                >
                  Продолжить
                </button>
              </article>
            </section>
          ) : null}

          <section className="home-section">
            <div className="section-heading">
              <div>
                <h2>Купить сейчас</h2>
                <p>{urgentItems.length ? formatPositionCount(urgentItems.length) : "Пока спокойно"}</p>
              </div>
            </div>
            {urgentItems.length ? (
              <div className="item-list">
                {urgentItems.map((item) => {
                  const shoppingStatus = shoppingStatusLabels[item.status] ?? statusLabels[item.status];

                  return (
                    <article className="shopping-row shopping-item-card" key={item.id}>
                      <div className="shopping-item-card-head">
                        <button
                          aria-label={`Открыть ${item.name}`}
                          className="shopping-row-open"
                          type="button"
                          onClick={() => handleSelectCategory(item.categoryId)}
                        >
                          <span className="shopping-row-title">{item.name}</span>
                        </button>
                        <button
                          type="button"
                          disabled={isActionPending(`item:status:${item.id}`)}
                          onClick={() =>
                            void handleSetStatus(item, "IN_STOCK").catch((caughtError) =>
                              setError(formatError(caughtError))
                            )
                          }
                        >
                          {isActionPending(`item:status:${item.id}`) ? "Отмечаем..." : "Куплено"}
                        </button>
                      </div>
                      <div className="shopping-item-card-body">
                        {item.category?.name ? (
                          <span className="metadata-text">{item.category.name}</span>
                        ) : null}
                        <span
                          className={
                            item.status === "URGENT" ? "badge badge-urgent" : "badge badge-muted"
                          }
                        >
                          {shoppingStatus}
                        </span>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <p className="empty">Нет товаров, которые нужно купить прямо сейчас.</p>
            )}
          </section>

          <section className="home-section">
            <div className="section-heading">
              <div>
                <h2>Напоминания</h2>
                <p>
                  {inAppReminders.length ? `${inAppReminders.length} активных` : "Нет дат"}
                </p>
              </div>
            </div>
            {inAppReminders.length ? (
              <div className="reminder-groups">
                {categoryReminders.length ? (
                  <section className="reminder-group" aria-label="Напоминания категорий">
                    <div className="reminder-group-heading">
                      <h3>Категории</h3>
                      <span>{formatReminderCount(categoryReminders.length)}</span>
                    </div>
                    {renderReminderList(categoryReminders)}
                  </section>
                ) : null}
                {groupReminders.length ? (
                  <section className="reminder-group" aria-label="Напоминания наборов">
                    <div className="reminder-group-heading">
                      <h3>Наборы</h3>
                      <span>{formatReminderCount(groupReminders.length)}</span>
                    </div>
                    {renderReminderList(groupReminders)}
                  </section>
                ) : null}
                {itemReminders.length ? (
                  <section className="reminder-group" aria-label="Напоминания товаров">
                    <div className="reminder-group-heading">
                      <h3>Товары</h3>
                      <span>{formatReminderCount(itemReminders.length)}</span>
                    </div>
                    {renderReminderList(itemReminders)}
                  </section>
                ) : null}
              </div>
            ) : (
              <p className="empty">Добавьте циклы проверки, чтобы видеть ближайшие даты.</p>
            )}
          </section>
        </section>
      ) : activeTab === "items" ? (
        <section className="stack">
          <div className="section-heading">
            <div>
              <h2>Категории</h2>
              <p>{categories.length ? `${categories.length} активных` : "Пока нет"}</p>
            </div>
            <div className="icon-actions">
              {showShareEntryPoint ? (
                <button
                  aria-label="Поделиться списком"
                  className="ghost-button icon-button"
                  title="Поделиться списком"
                  type="button"
                  onClick={() => setActiveTab("settings")}
                >
                  <Users aria-hidden="true" size={18} />
                </button>
              ) : null}
              <button
                aria-label={showCategoryForm ? "Скрыть форму категории" : "Новая категория"}
                className="ghost-button icon-button"
                title={showCategoryForm ? "Скрыть" : "Новая категория"}
                type="button"
                onClick={() => setShowCategoryForm((current) => !current)}
              >
                {showCategoryForm ? (
                  <X aria-hidden="true" size={18} />
                ) : (
                  <Plus aria-hidden="true" size={18} />
                )}
              </button>
            </div>
          </div>

          {showCategoryForm ? (
            <form
              className="inline-form category-create-form"
              onSubmit={(event) => {
                event.preventDefault();
                void handleCreateCategory().catch((caughtError) =>
                  setError(formatError(caughtError))
                );
              }}
            >
              <input
                aria-label="Название категории"
                placeholder="Название категории"
                value={categoryName}
                disabled={isActionPending("category:create")}
                onChange={(event) => setCategoryName(event.target.value)}
              />
              <button
                type="submit"
                disabled={isActionPending("category:create") || !categoryName.trim()}
              >
                {isActionPending("category:create") ? "Создаем..." : "Создать"}
              </button>
            </form>
          ) : null}

          <div className="category-row" aria-label="Категории">
            {categories.map((category) => (
              <button
                className={selectedCategory?.id === category.id ? "category active" : "category"}
                key={category.id}
                type="button"
                onClick={() => {
                  clearSearchSession();
                  setSelectedCategoryId(category.id);
                  setShowCategoryForm(false);
                }}
              >
                <span>{category.icon ? `${category.icon} ` : ""}{category.name}</span>
                <small>
                  {categoryStatusLabels[category.aggregateStatus]} · {category.itemCount}
                </small>
              </button>
            ))}
          </div>

          {selectedCategory ? (
            <section className="category-panel" aria-label={selectedCategory.name}>
              <div className="section-heading">
                <div>
                  <h2>{selectedCategory.name}</h2>
                  <p>
                    {categoryStatusLabels[selectedCategory.aggregateStatus]} ·{" "}
                    {selectedCategory.itemCount} поз.
                  </p>
                </div>
                <div className="icon-actions">
                  <button
                    className="ghost-button"
                    disabled={selectedCategory.itemCount === 0}
                    type="button"
                    onClick={() =>
                      void handleStartCategoryCheck().catch((caughtError) =>
                        setError(formatError(caughtError))
                      )
                    }
                  >
                    Проверить
                  </button>
                  <button
                    className="ghost-button danger-button"
                    type="button"
                    onClick={() =>
                      void handleArchiveSelectedCategory().catch((caughtError) =>
                        setError(formatError(caughtError))
                      )
                    }
                  >
                    Архив
                  </button>
                </div>
              </div>

              <form
                className="inline-form item-create-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  void handleCreateItem().catch((caughtError) => setError(formatError(caughtError)));
                }}
              >
                <input
                  aria-label="Название товара"
                  placeholder={`Товар: ${selectedCategory.name}`}
                  value={itemName}
                  disabled={isActionPending("item:create")}
                  onChange={(event) => setItemName(event.target.value)}
                />
                <button type="submit" disabled={isActionPending("item:create") || !itemName.trim()}>
                  {isActionPending("item:create") ? "Добавляем..." : "Добавить"}
                </button>
              </form>

              {visibleRecommendations.length ? (
                <section className="recommendations" aria-label="Рекомендации">
                  <div>
                    <p className="eyebrow">Рекомендации</p>
                    <h2>
                      {recommendationSourceItemName
                        ? `Вместе с "${recommendationSourceItemName}"`
                        : "Можно добавить"}
                    </h2>
                  </div>
                  <div className="recommendation-list">
                    {visibleRecommendations.map((recommendation) => (
                      <article className="recommendation-row" key={recommendation.id}>
                        <div>
                          <h3>{recommendation.suggestedItem}</h3>
                          <span>{recommendation.categoryHint ?? "Категория исходного товара"}</span>
                        </div>
                        <div className="shopping-actions">
                          <button
                            className="ghost-button"
                            type="button"
                            onClick={() =>
                              void handleDismissRecommendation(recommendation).catch(
                                (caughtError) => setError(formatError(caughtError))
                              )
                            }
                          >
                            Не нужно
                          </button>
                          <button
                            className="ghost-button"
                            type="button"
                            onClick={() =>
                              void handleHideSimilarRecommendations(recommendation).catch(
                                (caughtError) => setError(formatError(caughtError))
                              )
                            }
                          >
                            Скрыть похожие
                          </button>
                          <button
                            type="button"
                            disabled={isActionPending(`recommendation:add:${recommendation.id}`)}
                            onClick={() =>
                              void handleAcceptRecommendation(recommendation).catch(
                                (caughtError) => setError(formatError(caughtError))
                              )
                            }
                          >
                            {isActionPending(`recommendation:add:${recommendation.id}`)
                              ? "Добавляем..."
                              : "Добавить"}
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              ) : null}

              <div className="item-list">
                {visibleItems.length ? (
                  visibleItems.map((item) => (
                    <article className="item-card" key={item.id}>
                      {editingItemId === item.id ? (
                        <form
                          className="inline-form"
                          onSubmit={(event) => {
                            event.preventDefault();
                            void handleUpdateItem(item).catch((caughtError) =>
                              setError(formatError(caughtError))
                            );
                          }}
                        >
                          <input
                            aria-label="Новое название товара"
                            value={editingItemName}
                            onChange={(event) => setEditingItemName(event.target.value)}
                          />
                          <button type="submit">Сохранить</button>
                        </form>
                      ) : (
                        <div className="item-card-header">
                          <div>
                            <h2>{item.name}</h2>
                          </div>
                          <div className="icon-actions">
                            <button
                              aria-label={`Изменить товар ${item.name}`}
                              className="ghost-button icon-button"
                              title="Изменить"
                              type="button"
                              onClick={() => {
                                setEditingItemId(item.id);
                                setEditingItemName(item.name);
                              }}
                            >
                              <Pencil aria-hidden="true" size={18} />
                            </button>
                            <button
                              aria-label={`Архивировать товар ${item.name}`}
                              className="ghost-button danger-button icon-button"
                              title="Архивировать"
                              type="button"
                              onClick={() =>
                                void handleArchiveItem(item).catch((caughtError) =>
                                  setError(formatError(caughtError))
                                )
                              }
                            >
                              <Archive aria-hidden="true" size={18} />
                            </button>
                          </div>
                        </div>
                      )}
                      <select
                        aria-label={`Статус товара ${item.name}`}
                        className="status-select"
                        data-status={item.status}
                        disabled={isActionPending(`item:status:${item.id}`)}
                        value={item.status}
                        onChange={(event) =>
                          void handleSetStatus(item, event.target.value as ItemStatus).catch(
                            (caughtError) => setError(formatError(caughtError))
                          )
                        }
                      >
                        {statusOptions.map((status) => (
                          <option key={status} value={status}>
                            {statusLabels[status]}
                          </option>
                        ))}
                        {item.status === "PAUSED" ? (
                          <option value="PAUSED">{statusLabels.PAUSED}</option>
                        ) : null}
                      </select>
                    </article>
                  ))
                ) : (
                  <p className="empty">Добавьте первый товар в эту категорию.</p>
                )}
              </div>
            </section>
          ) : (
            <p className="empty">Создайте категорию, чтобы добавить первый товар.</p>
          )}
        </section>
      ) : activeTab === "shopping" ? (
        <section className="stack">
          <div className="section-heading">
            <div>
              <h2>Покупки</h2>
              <p>{shoppingList.length ? `${shoppingList.length} активных` : "Пусто"}</p>
            </div>
            <button
              className="ghost-button"
              type="button"
              onClick={() =>
                void handleClearCompletedShoppingList().catch((caughtError) =>
                  setError(formatError(caughtError))
                )
              }
            >
              Очистить
            </button>
          </div>

          <form
            className="shopping-form"
            onSubmit={(event) => {
              event.preventDefault();
              void handleCreateManualShoppingItem().catch((caughtError) =>
                setError(formatError(caughtError))
              );
            }}
          >
            <input
              aria-label="Разовая покупка"
              placeholder="Разовая покупка"
              value={manualShoppingTitle}
              disabled={isActionPending("shopping:add")}
              onChange={(event) => setManualShoppingTitle(event.target.value)}
            />
            <select
              aria-label="Категория покупки"
              value={manualShoppingCategoryId}
              disabled={isActionPending("shopping:add")}
              onChange={(event) => setManualShoppingCategoryId(event.target.value)}
            >
              <option value="">Без категории</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            <select
              aria-label="Приоритет покупки"
              value={manualShoppingPriority}
              disabled={isActionPending("shopping:add")}
              onChange={(event) => setManualShoppingPriority(event.target.value as ShoppingPriority)}
            >
              <option value="NORMAL">Купить</option>
              <option value="URGENT">Срочно</option>
            </select>
            <button
              type="submit"
              disabled={isActionPending("shopping:add") || !manualShoppingTitle.trim()}
            >
              {isActionPending("shopping:add") ? "Добавляем..." : "Добавить"}
            </button>
          </form>

          {shoppingGroups.length ? (
            <div className="shopping-groups">
              {shoppingGroups.map((group) => (
                <section className="shopping-group" key={group.id}>
                  <h3>{group.title}</h3>
                  {group.entries.map((entry) => (
                    <article className="shopping-row" key={entry.id}>
                      {editingShoppingId === entry.id ? (
                        <form
                          className="inline-form"
                          onSubmit={(event) => {
                            event.preventDefault();
                            void handleUpdateManualShoppingItem(entry).catch((caughtError) =>
                              setError(formatError(caughtError))
                            );
                          }}
                        >
                          <input
                            aria-label="Новое название покупки"
                            value={editingShoppingTitle}
                            onChange={(event) => setEditingShoppingTitle(event.target.value)}
                          />
                          <button type="submit">Сохранить</button>
                        </form>
                      ) : (
                        <div>
                          <span className={entry.priority === "URGENT" ? "badge badge-urgent" : "badge badge-muted"}>
                            {entry.priority === "URGENT" ? "Срочно" : "Купить"}
                          </span>
                          <h2>{entry.title}</h2>
                          <span>{entry.itemId ? "Отслеживаемый товар" : "Разовая позиция"}</span>
                        </div>
                      )}
                      <div className="shopping-actions">
                        {!entry.itemId && editingShoppingId !== entry.id ? (
                          <>
                            <button
                              className="ghost-button"
                              type="button"
                              onClick={() => {
                                setEditingShoppingId(entry.id);
                                setEditingShoppingTitle(entry.title);
                              }}
                            >
                              Изм.
                            </button>
                            <button
                              className="ghost-button danger-button"
                              type="button"
                              onClick={() =>
                                void handleDeleteManualShoppingItem(entry).catch((caughtError) =>
                                  setError(formatError(caughtError))
                                )
                              }
                            >
                              Удалить
                            </button>
                          </>
                        ) : null}
                        <button
                          type="button"
                          disabled={isActionPending(`shopping:bought:${entry.id}`)}
                          onClick={() =>
                            void handleCompleteShoppingListItem(entry).catch((caughtError) =>
                              setError(formatError(caughtError))
                            )
                          }
                        >
                          {isActionPending(`shopping:bought:${entry.id}`) ? "Отмечаем..." : "Куплено"}
                        </button>
                      </div>
                    </article>
                  ))}
                </section>
              ))}
            </div>
          ) : (
            <p className="empty">Список покупок пуст.</p>
          )}
        </section>
      ) : activeTab === "groups" ? (
        <section className="stack">
          <form
            className="inline-form"
            onSubmit={(event) => {
              event.preventDefault();
              void handleCreateGroup().catch((caughtError) => setError(formatError(caughtError)));
            }}
          >
            <input
              aria-label="Название набора"
              placeholder="Новый набор"
              value={groupName}
              disabled={isActionPending("group:create")}
              onChange={(event) => setGroupName(event.target.value)}
            />
            <button type="submit" disabled={isActionPending("group:create") || !groupName.trim()}>
              {isActionPending("group:create") ? "Добавляем..." : "Добавить"}
            </button>
          </form>

          <div className="category-row" aria-label="Наборы">
            {groups.map((group) => (
              <button
                className={selectedGroup?.id === group.id ? "category active" : "category"}
                key={group.id}
                type="button"
                onClick={() => setSelectedGroupId(group.id)}
              >
                <span>{group.icon ? `${group.icon} ` : ""}{group.name}</span>
                <small>{group.items.length} поз.</small>
              </button>
            ))}
          </div>

          {selectedGroup ? (
            <>
              <div className="section-heading">
                <div>
                  <h2>{selectedGroup.name}</h2>
                  <p>{selectedGroup.items.length} поз.</p>
                </div>
                <div className="icon-actions">
                  <button
                    className="ghost-button"
                    disabled={selectedGroupCheckItemCount === 0}
                    type="button"
                    onClick={() =>
                      void handleStartGroupCheck().catch((caughtError) =>
                        setError(formatError(caughtError))
                      )
                    }
                  >
                    Проверить
                  </button>
                  <button
                    className="ghost-button danger-button"
                    type="button"
                    onClick={() =>
                      void handleArchiveSelectedGroup().catch((caughtError) =>
                        setError(formatError(caughtError))
                      )
                    }
                  >
                    Архив
                  </button>
                </div>
              </div>

              <form
                className="inline-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  void handleAddGroupItem().catch((caughtError) => setError(formatError(caughtError)));
                }}
              >
                <select
                  aria-label="Товар для набора"
                  value={groupItemId}
                  disabled={isActionPending("group:item:add")}
                  onChange={(event) => setGroupItemId(event.target.value)}
                >
                  <option value="">Выберите товар</option>
                  {items
                    .filter(
                      (item) =>
                        !selectedGroup.items.some((groupItem) => groupItem.itemId === item.id)
                    )
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                </select>
                <button
                  type="submit"
                  disabled={isActionPending("group:item:add") || !groupItemId}
                >
                  {isActionPending("group:item:add") ? "Добавляем..." : "Добавить"}
                </button>
              </form>

              <div className="item-list">
                {selectedGroup.items.length ? (
                  selectedGroup.items.map((groupItem) => (
                    <article className="shopping-row" key={groupItem.id}>
                      <div>
                        <h2>{groupItem.item.name}</h2>
                        <span>{statusLabels[groupItem.item.status]}</span>
                      </div>
                      <button
                        className="ghost-button danger-button"
                        type="button"
                        onClick={() =>
                          void handleRemoveGroupItem(groupItem.itemId).catch((caughtError) =>
                            setError(formatError(caughtError))
                          )
                        }
                      >
                        Убрать
                      </button>
                    </article>
                  ))
                ) : (
                  <p className="empty">Добавьте товары в набор.</p>
                )}
              </div>
            </>
          ) : (
            <p className="empty">Создайте набор для совместной проверки товаров.</p>
          )}
        </section>
      ) : activeTab === "check" ? (
        <section className="stack">
          <div className="section-heading">
            <div>
              <h2>Проверка</h2>
              <p>
                {checkSession
                  ? `${checkedCount} из ${checkSession.items.length}`
                  : "Выберите категорию"}
              </p>
            </div>
            {checkSession?.status === "IN_PROGRESS" ? (
              <button
                className="ghost-button"
                type="button"
                onClick={() =>
                  void handleCancelCheck().catch((caughtError) => setError(formatError(caughtError)))
                }
              >
                Отмена
              </button>
            ) : null}
          </div>

          {checkSession?.status !== "IN_PROGRESS" ? (
            <form
              className="inline-form"
              onSubmit={(event) => {
                event.preventDefault();
                void handleStartCategoryCheck().catch((caughtError) =>
                  setError(formatError(caughtError))
                );
              }}
            >
              <select
                aria-label="Категория для проверки"
                value={selectedCategory?.id ?? ""}
                onChange={(event) => {
                  clearSearchSession();
                  setSelectedCategoryId(event.target.value);
                }}
              >
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
              <button type="submit" disabled={!selectedCategory || selectedCategory.itemCount === 0}>
                Начать
              </button>
            </form>
          ) : null}

          {checkSession?.status === "COMPLETED" ? (
            <p className="empty">
              {pendingCheckItemName
                ? `Завершаем проверку, сохраняем "${pendingCheckItemName}"...`
                : "Проверка завершена."}
            </p>
          ) : checkSession?.status === "CANCELLED" ? (
            <p className="empty">Проверка отменена.</p>
          ) : currentCheckItem ? (
            <article className="check-card">
              <p className="eyebrow">
                {checkSession?.category?.name ?? checkSession?.group?.name ?? "Проверка"}
              </p>
              <h2>{currentCheckItem.item.name}</h2>
              {pendingCheckItemName ? (
                <p className="check-saving" role="status">
                  Сохраняем "{pendingCheckItemName}"...
                </p>
              ) : null}
              <div className="status-grid">
                {statusOptions.map((status) => (
                  <button
                    disabled={Boolean(pendingCheckItemName)}
                    key={status}
                    type="button"
                    onClick={() =>
                      void handleCheckStatus(status).catch((caughtError) =>
                        setError(formatError(caughtError))
                      )
                    }
                  >
                    {statusLabels[status]}
                  </button>
                ))}
              </div>
            </article>
          ) : (
            <p className="empty">
              {pendingCheckItemName
                ? `Сохраняем "${pendingCheckItemName}"...`
                : "Выберите категорию и начните пошаговую проверку."}
            </p>
          )}
        </section>
      ) : activeTab === "search" ? (
        <section className="stack">
          <div className="section-heading">
            <div>
              <h2>Поиск</h2>
              <p>{hasSearched ? `Запрос: ${searchQuery}` : "Название, бренд, заметки или категория"}</p>
            </div>
          </div>

          <div className="item-list">
            {searchResults.length ? (
              searchResults.map((item) => (
                <article className="shopping-row" key={item.id}>
                  <div>
                    <p>{item.category?.name ?? "Без категории"}</p>
                    <h2>{item.name}</h2>
                    <span>{statusLabels[item.status]}</span>
                  </div>
                  <button
                    className="ghost-button"
                    type="button"
                    onClick={() => {
                      clearSearchSession();
                      setSelectedCategoryId(item.categoryId);
                      setActiveTab("items");
                    }}
                  >
                    Открыть
                  </button>
                </article>
              ))
            ) : hasSearched ? (
              <p className="empty">Ничего не найдено.</p>
            ) : (
              <p className="empty">Введите запрос, чтобы найти отслеживаемые товары.</p>
            )}
          </div>
        </section>
      ) : activeTab === "archive" ? (
        <section className="stack">
          <div className="section-heading">
            <div>
              <h2>Архив</h2>
              <p>
                {archivedCategories.length + archivedStandaloneItems.length
                  ? `${archivedCategories.length} кат. · ${archivedStandaloneItems.length} тов.`
                  : "Архив пуст"}
              </p>
            </div>
          </div>

          <section className="archive-section" aria-label="Архивные категории">
            <div className="section-heading">
              <div>
                <h2>Категории</h2>
                <p>Вернутся вместе с товарами, архивированными в тот же момент.</p>
              </div>
            </div>

            <div className="item-list">
              {archivedCategories.length ? (
                archivedCategories.map((category) => (
                  <article className="shopping-row" key={category.id}>
                    <div>
                      <p>{category.itemCount} поз.</p>
                      <h2>{category.icon ? `${category.icon} ` : ""}{category.name}</h2>
                      <span>{formatDate(category.archivedAt)}</span>
                    </div>
                    <div className="shopping-actions">
                      <button
                        className="ghost-button"
                        type="button"
                        onClick={() =>
                          void handleRestoreCategory(category).catch((caughtError) =>
                            setError(formatError(caughtError))
                          )
                        }
                      >
                        Вернуть
                      </button>
                      <button
                        className="ghost-button danger-button"
                        type="button"
                        onClick={() =>
                          void handleDeleteArchivedCategory(category).catch((caughtError) =>
                            setError(formatError(caughtError))
                          )
                        }
                      >
                        Удалить
                      </button>
                    </div>
                  </article>
                ))
              ) : (
                <p className="empty">Архивных категорий нет.</p>
              )}
            </div>
          </section>

          <section className="archive-section" aria-label="Архивные товары">
            <div className="section-heading">
              <div>
                <h2>Товары</h2>
                <p>Отдельно архивированные товары из активных категорий.</p>
              </div>
            </div>

            <div className="item-list">
              {archivedStandaloneItems.length ? (
                archivedStandaloneItems.map((item) => (
                  <article className="shopping-row" key={item.id}>
                    <div>
                      <p>{item.category?.name ?? "Без категории"}</p>
                      <h2>{item.name}</h2>
                      <span>
                        {statusLabels[item.status]} · {formatDate(item.archivedAt)}
                      </span>
                    </div>
                    <div className="shopping-actions">
                      <button
                        className="ghost-button"
                        type="button"
                        onClick={() =>
                          void handleRestoreItem(item).catch((caughtError) =>
                            setError(formatError(caughtError))
                          )
                        }
                      >
                        Вернуть
                      </button>
                      <button
                        className="ghost-button danger-button"
                        type="button"
                        onClick={() =>
                          void handleDeleteArchivedItem(item).catch((caughtError) =>
                            setError(formatError(caughtError))
                          )
                        }
                      >
                        Удалить
                      </button>
                    </div>
                  </article>
                ))
              ) : (
                <p className="empty">Отдельно архивированных товаров нет.</p>
              )}
            </div>
          </section>
        </section>
      ) : (
        <section className="stack">
          <div className="section-heading">
            <div>
              <h2>Настройки</h2>
              <p>Совместный доступ, проверки, экспорт и удаление данных</p>
            </div>
          </div>

          {activeWorkspace ? (
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

              {canManageActiveWorkspace ? (
                <>
                  <form
                    className="workspace-invite-form"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void handleCreateWorkspaceInvitation().catch((caughtError) =>
                        setError(formatError(caughtError))
                      );
                    }}
                  >
                    <input
                      aria-label="Email участника"
                      inputMode="email"
                      placeholder="email пользователя в сервисе"
                      value={workspaceInviteEmail}
                      disabled={workspaceAction === "invite"}
                      onChange={(event) => setWorkspaceInviteEmail(event.target.value)}
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

                  {workspaceMessage ? <p className="success-message">{workspaceMessage}</p> : null}
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
                                      onClick={() =>
                                        void handleTransferWorkspaceOwnership(member).catch(
                                          (caughtError) => setError(formatError(caughtError))
                                        )
                                      }
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
                                      onClick={() =>
                                        void handleRemoveWorkspaceMember(member).catch(
                                          (caughtError) => setError(formatError(caughtError))
                                        )
                                      }
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
                            onClick={() =>
                              void refreshWorkspaceAccess(token, activeWorkspace.id).catch(
                                (caughtError) => setError(formatError(caughtError))
                              )
                            }
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
                                onClick={() =>
                                  void handleRevokeWorkspaceInvitation(invitation).catch(
                                    (caughtError) => setError(formatError(caughtError))
                                  )
                                }
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
          ) : (
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
                onClick={() =>
                  void handleRetryWorkspaceLoad().catch((caughtError) =>
                    setError(formatError(caughtError))
                  )
                }
              >
                Обновить списки
              </button>
            </section>
          )}

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
                entityType: "CATEGORY",
                title: category.name,
                subtitle: category.nextCheckAt
                  ? `Следующая: ${formatDate(category.nextCheckAt)}`
                  : "Дата не задана"
              }))}
              drafts={reminderDrafts}
              onDraftChange={updateReminderDraft}
              onSave={() =>
                void handleSaveReminderSettingsGroup(
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
                entityType: "GROUP",
                title: group.name,
                subtitle: group.nextCheckAt
                  ? `Следующая: ${formatDate(group.nextCheckAt)}`
                  : "Дата не задана"
              }))}
              drafts={reminderDrafts}
              onDraftChange={updateReminderDraft}
              onSave={() =>
                void handleSaveReminderSettingsGroup(
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
                entityType: "ITEM",
                title: item.name,
                subtitle: item.nextCheckAt
                  ? `Следующая: ${formatDate(item.nextCheckAt)}`
                  : "Дата не задана"
              }))}
              drafts={reminderDrafts}
              onDraftChange={updateReminderDraft}
              onSave={() =>
                void handleSaveReminderSettingsGroup(
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
                void handleExportUserData().catch((caughtError) =>
                  setError(formatError(caughtError))
                )
              }
            >
              Скачать JSON
            </button>
            <button
              className="ghost-button"
              type="button"
              onClick={handleSignOut}
            >
              Выйти
            </button>
            <button
              className="ghost-button danger-button"
              type="button"
              onClick={() =>
                void handleDeleteAccount().catch((caughtError) =>
                  setError(formatError(caughtError))
                )
              }
            >
              Удалить аккаунт
            </button>
          </div>
        </section>
      )}
      </div>

      <nav className="bottom-nav" aria-label="Основные разделы">
        {navTabs.map((tab) => {
          const Icon = tab.icon;

          return (
            <button
              className={activeTab === tab.id ? "active" : ""}
              key={tab.id}
              type="button"
              onClick={() => handleSelectTab(tab.id)}
            >
              <Icon aria-hidden="true" size={18} strokeWidth={2.25} />
              <span>{tab.label}</span>
            </button>
          );
        })}
        <button
          aria-controls="menu-sheet"
          aria-expanded={showMenuSheet}
          className={
            showMenuSheet || menuTabs.some((tab) => tab.id === activeTab) ? "active" : ""
          }
          type="button"
          onClick={() => setShowMenuSheet((current) => !current)}
        >
          <Menu aria-hidden="true" size={18} strokeWidth={2.25} />
          <span>Меню</span>
        </button>
      </nav>

      {showMenuSheet ? (
        <div className="menu-sheet-overlay" onClick={() => setShowMenuSheet(false)}>
          <section
            aria-label="Дополнительные разделы"
            className="menu-sheet"
            id="menu-sheet"
            role="dialog"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="menu-sheet-header">
              <strong>Разделы</strong>
              <button
                aria-label="Закрыть меню"
                className="ghost-button"
                type="button"
                onClick={() => setShowMenuSheet(false)}
              >
                <X aria-hidden="true" size={18} />
              </button>
            </div>
            {activeWorkspace && showWorkspaceSwitcher ? (
              <label className="workspace-switcher">
                <span>Список</span>
                <select
                  aria-label="Активный список"
                  value={activeWorkspace.id}
                  onChange={(event) =>
                    void handleSelectWorkspace(event.target.value).catch((caughtError) =>
                      setError(formatError(caughtError))
                    )
                  }
                >
                  {workspaces.map((workspace) => (
                    <option key={workspace.id} value={workspace.id}>
                      {workspace.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {menuTabs.map((tab) => {
              const Icon = tab.icon;

              return (
                <button
                  className={activeTab === tab.id ? "menu-item active" : "menu-item"}
                  key={tab.id}
                  type="button"
                  onClick={() => handleSelectMenuTab(tab.id)}
                >
                  <Icon aria-hidden="true" size={18} strokeWidth={2.25} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </section>
        </div>
      ) : null}

      {showNotifications ? (
        <div className="menu-sheet-overlay" onClick={() => setShowNotifications(false)}>
          <section
            aria-label="Уведомления"
            className="menu-sheet notification-sheet"
            id="notification-sheet"
            role="dialog"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="menu-sheet-header">
              <strong>Уведомления</strong>
              <button
                aria-label="Закрыть уведомления"
                className="ghost-button"
                type="button"
                onClick={() => setShowNotifications(false)}
              >
                <X aria-hidden="true" size={18} />
              </button>
            </div>
            {notificationCount ? (
              <>
                {shoppingList.length ? (
                  <div className="notification-list" aria-label="Что купить">
                    <p className="eyebrow">Купить</p>
                    {shoppingList.map((entry) => (
                      <button
                        className="notification-row"
                        key={entry.id}
                        type="button"
                        onClick={() => {
                          setShowNotifications(false);
                          if (entry.item) {
                            handleSelectCategory(entry.item.categoryId);
                          } else {
                            handleSelectTab("shopping");
                          }
                        }}
                      >
                        <span className="notification-row-title">{entry.title}</span>
                        <span className="shopping-meta-line">
                          {entry.category?.name ? (
                            <span className="metadata-text">{entry.category.name}</span>
                          ) : null}
                          <span
                            className={
                              entry.priority === "URGENT" ? "badge badge-urgent" : "badge badge-muted"
                            }
                          >
                            {entry.priority === "URGENT" ? "Срочно" : "Купить"}
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                ) : null}
                {inAppReminders.length ? (
                  <div className="notification-list" aria-label="Что проверить">
                    <p className="eyebrow">Проверить</p>
                    {inAppReminders.map((reminder) => (
                      <button
                        className="notification-row"
                        key={reminder.id}
                        type="button"
                        onClick={() => {
                          setShowNotifications(false);
                          handleOpenReminder(reminder);
                        }}
                      >
                        <span className="notification-row-title">{reminder.title}</span>
                        <span className="shopping-meta-line">
                          <span
                            className={
                              reminder.timing === "DUE" ? "badge badge-urgent" : "badge badge-muted"
                            }
                          >
                            {reminder.timing === "DUE" ? "Пора проверить" : "Скоро"} ·{" "}
                            {formatDate(reminder.nextCheckAt)}
                          </span>
                          <span className="metadata-text">
                            {reminderEntityLabels[reminder.entityType]}
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </>
            ) : (
              <p className="empty">Нет уведомлений.</p>
            )}
          </section>
        </div>
      ) : null}
    </main>
  );
}

function getReminderDraftKey(entityType: InAppReminder["entityType"], entityId: string): string {
  return `${entityType}:${entityId}`;
}

function formatWorkspaceMemberName(member: WorkspaceMember): string {
  return member.user.displayName ?? member.user.firstName ?? member.user.email ?? "Участник";
}

function BrandWord() {
  return (
    <>
      <span>kupit</span>
      <span className="brand-accent">nezabyt</span>
    </>
  );
}

function ReminderSettingsSection({
  title,
  emptyMessage,
  saveLabel,
  isSaving,
  rows,
  drafts,
  onDraftChange,
  onSave
}: {
  title: string;
  emptyMessage: string;
  saveLabel: string;
  isSaving: boolean;
  rows: {
    id: string;
    entityType: InAppReminder["entityType"];
    title: string;
    subtitle: string;
  }[];
  drafts: Record<string, ReminderDraft>;
  onDraftChange: (key: string, draft: ReminderDraft) => void;
  onSave: () => void;
}) {
  return (
    <section className="reminder-settings-group">
      <div className="reminder-group-header">
        <div>
          <h3>{title}</h3>
          {rows.length ? <p>Настройте каждую карточку и сохраните секцию целиком.</p> : null}
        </div>
        {rows.length ? (
          <button type="button" disabled={isSaving} onClick={onSave}>
            {isSaving ? "Сохраняем..." : saveLabel}
          </button>
        ) : null}
      </div>
      {rows.length ? (
        <div className="reminder-settings-list">
          {rows.map((row) => {
            const key = getReminderDraftKey(row.entityType, row.id);
            const draft = drafts[key] ?? {
              usageCycleDays: "",
              reminderEnabled: true
            };

            return (
              <article className="reminder-settings-row" key={key}>
                <div>
                  <h4>{row.title}</h4>
                  <p>{row.subtitle}</p>
                </div>
                <label className="reminder-toggle">
                  <input
                    aria-label={`Напоминания: ${row.title}`}
                    checked={draft.reminderEnabled}
                    disabled={isSaving}
                    type="checkbox"
                    onChange={(event) =>
                      onDraftChange(key, {
                        ...draft,
                        reminderEnabled: event.target.checked
                      })
                    }
                  />
                  <span>Вкл.</span>
                </label>
                <input
                  aria-label={`Цикл проверки: ${row.title}`}
                  disabled={isSaving}
                  inputMode="numeric"
                  min="1"
                  placeholder="Дней"
                  type="number"
                  value={draft.usageCycleDays}
                  onChange={(event) =>
                    onDraftChange(key, {
                      ...draft,
                      usageCycleDays: event.target.value
                    })
                  }
                />
              </article>
            );
          })}
        </div>
      ) : (
        <p className="empty">{emptyMessage}</p>
      )}
    </section>
  );
}

function formatError(error: unknown): string {
  if (error instanceof ApiError) {
    return getFriendlyErrorMessage(error.message);
  }

  if (error instanceof Error) {
    return getFriendlyErrorMessage(error.message);
  }

  return "Что-то пошло не так.";
}

function getFriendlyErrorMessage(message: string): string {
  const authErrorMessages: Record<string, string> = {
    EMAIL_AUTH_REQUIRED: "Войдите через Google или получите ссылку на email.",
    "Failed to fetch": "Не удалось подключиться к сервису. Попробуйте обновить страницу.",
    "Load failed": "Не удалось подключиться к сервису. Попробуйте еще раз.",
    NETWORK_ERROR: "Не удалось подключиться к сервису. Попробуйте еще раз.",
    GOOGLE_AUTH_CANCELLED: "Вход через Google отменен.",
    GOOGLE_AUTH_FAILED: "Не удалось завершить вход через Google. Попробуйте еще раз.",
    GOOGLE_AUTH_INVALID_CALLBACK: "Google вернул неполный ответ. Попробуйте войти еще раз.",
    GOOGLE_AUTH_INVALID_STATE: "Сессия входа устарела. Начните вход через Google заново.",
    GOOGLE_AUTH_INVALID_TOKEN: "Не удалось проверить Google-аккаунт. Попробуйте еще раз.",
    GOOGLE_AUTH_NOT_CONFIGURED: "Вход через Google временно недоступен. Используйте email-ссылку.",
    APPLE_AUTH_CANCELLED: "Вход через Apple отменен.",
    APPLE_AUTH_FAILED: "Не удалось завершить вход через Apple. Попробуйте еще раз.",
    APPLE_AUTH_INVALID_CALLBACK: "Apple вернул неполный ответ. Попробуйте войти еще раз.",
    APPLE_AUTH_INVALID_STATE: "Сессия входа устарела. Начните вход через Apple заново.",
    APPLE_AUTH_INVALID_TOKEN: "Не удалось проверить Apple ID. Попробуйте еще раз.",
    APPLE_AUTH_NOT_CONFIGURED: "Вход через Apple временно недоступен. Используйте email-ссылку.",
    EMAIL_VERIFICATION_REQUIRED: "Войдите через email, на который пришло приглашение.",
    HTTP_404: "Данные не найдены. Обновите страницу и попробуйте еще раз.",
    NOT_FOUND: "Данные не найдены. Обновите страницу и попробуйте еще раз.",
    INVALID_INVITATION: "Приглашение недействительно или устарело.",
    INVITATION_EMAIL_MISMATCH: "Это приглашение отправлено на другой email.",
    INVITEE_NOT_FOUND:
      "Пользователь с таким email пока не найден. Сейчас можно приглашать только тех, кто уже входил в сервис.",
    EMPTY_CHECK_CATEGORY: "В этой категории пока нечего проверять.",
    EMPTY_CHECK_GROUP: "В этом наборе пока нечего проверять.",
    MEMBER_NOT_FOUND: "Участник не найден. Обновите список и попробуйте еще раз.",
    WORKSPACE_NOT_FOUND: "Список не найден или доступ к нему уже закрыт.",
    OWNED_SHARED_WORKSPACE_REQUIRES_TRANSFER:
      "Перед удалением аккаунта передайте владение общим списком или удалите участников."
  };

  return authErrorMessages[message] ?? message;
}

function isNotFoundError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const normalizedMessage = error.message.toLowerCase();
  return (
    error.message === "HTTP_404" ||
    error.message === "NOT_FOUND" ||
    error.message.endsWith("_NOT_FOUND") ||
    normalizedMessage === "not found" ||
    normalizedMessage.includes("was not found")
  );
}

function ErrorNotice({
  message,
  onClose
}: {
  message: string | null;
  onClose: () => void;
}) {
  if (!message) {
    return null;
  }

  return (
    <div className="notice" role="alert">
      <span>{message}</span>
      <button
        className="notice-close"
        type="button"
        aria-label="Закрыть ошибку"
        onClick={onClose}
      >
        Закрыть
      </button>
    </div>
  );
}

function ToastNotice({
  message,
  onClose
}: {
  message: string | null;
  onClose: () => void;
}) {
  if (!message) {
    return null;
  }

  return (
    <div className="toast-notice" role="status">
      <span>{message}</span>
      {/* TODO: Add undo once purchase completion has a rollback path. */}
      <button type="button" aria-label="Закрыть уведомление" onClick={onClose}>
        Закрыть
      </button>
    </div>
  );
}

function formatDate(value: string | null): string {
  if (!value) {
    return "Дата не задана";
  }

  return new Intl.DateTimeFormat("ru", {
    day: "2-digit",
    month: "short"
  }).format(new Date(value));
}

function calculateSnoozedAt(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}
