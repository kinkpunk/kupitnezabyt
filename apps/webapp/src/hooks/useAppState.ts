"use client";

import type { ItemImportance, ItemStatus } from "@kupitnezabyt/shared";
import { useEffect, useMemo, useState } from "react";

import {
  acceptRecommendation,
  addGroupItem,
  archiveCategory,
  archiveGroup,
  archiveItem,
  cancelCheckSession,
  clearActiveWorkspaceId,
  clearCompletedShoppingList,
  completeCheckSession,
  completeOnboarding,
  completeShoppingListItem,
  consumeInvitationAcceptedToast,
  createCategory,
  createGroup,
  createItem,
  createShoppingListItem,
  createWorkspaceInvitation,
  deleteAccount,
  deleteArchivedCategory,
  deleteArchivedItem,
  deleteShoppingListItem,
  dismissRecommendation,
  exportUserData,
  getActiveCheckSession,
  getArchivedCategories,
  getArchivedItems,
  getAuthProviders,
  getActiveWorkspaceId,
  getCategories,
  getCategorySortMode,
  getGroups,
  getInAppReminders,
  getItems,
  getMe,
  getRecommendations,
  getShoppingList,
  getWorkspaceInvitations,
  getWorkspaces,
  hideSimilarRecommendations,
  login,
  removeGroupItem,
  removeWorkspaceMember,
  reorderItems,
  requestMagicLink,
  restoreCategory,
  restoreItem,
  revokeWorkspaceInvitation,
  searchItems,
  setActiveWorkspaceId,
  setCategorySortMode,
  setCheckSessionItemStatus,
  setItemStatus,
  snoozeItemReminder,
  startAppleSignIn,
  startCategoryCheckSession,
  startGoogleSignIn,
  startGroupCheckSession,
  transferWorkspaceOwnership,
  updateCategory,
  updateGroup,
  updateItem,
  updateShoppingListItem,
  clearSavedToken
} from "../lib/api";
import type { CategorySortMode } from "../lib/api";
import { calculateSnoozedAt, formatError } from "../lib/format";
import {
  onboardingStorageKey,
  reminderSnoozeDays,
  starterCategories,
  themeStorageKey,
  type ThemeMode
} from "../lib/ui";
import { getReminderDraftKey } from "../lib/reminder-draft";
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

export type WorkspaceAction =
  | "invite"
  | "transfer"
  | `remove:${string}`
  | `revoke:${string}`;

export type ActiveTab =
  | "archive"
  | "check"
  | "groups"
  | "home"
  | "items"
  | "search"
  | "settings"
  | "shopping";

export type ReminderDraft = {
  usageCycleDays: string;
  reminderEnabled: boolean;
};

type StarterItemDraft = {
  name: string;
  categoryName: string;
};

const defaultStarterItems: StarterItemDraft[] = [
  { name: "Кофе", categoryName: "Еда" },
  { name: "Ибупрофен", categoryName: "Аптека" },
  { name: "Шампунь", categoryName: "Косметика" }
];

export function useAppState() {
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
  const [transferredAwayWorkspaceId, setTransferredAwayWorkspaceId] = useState<string | null>(null);
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
  const [categorySortMode, setCategorySortModeState] = useState<CategorySortMode>(() =>
    getCategorySortMode()
  );
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>("home");
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [showItemForm, setShowItemForm] = useState(false);
  const [categoryName, setCategoryName] = useState("");
  const [itemName, setItemName] = useState("");
  const [groupName, setGroupName] = useState("");
  const [groupItemId, setGroupItemId] = useState("");
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingItemName, setEditingItemName] = useState("");
  const [editingItemImportance, setEditingItemImportance] = useState<ItemImportance>("NORMAL");
  const [manualShoppingTitle, setManualShoppingTitle] = useState("");
  const [manualShoppingCategoryId, setManualShoppingCategoryId] = useState("");
  const [manualShoppingPriority, setManualShoppingPriority] = useState<"NORMAL" | "URGENT">("NORMAL");
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
  const [authProviders, setAuthProviders] = useState<{ google: boolean; apple: boolean } | null>(null);
  const [reminderDrafts, setReminderDrafts] = useState<Record<string, ReminderDraft>>({});
  const [savingReminderKeys, setSavingReminderKeys] = useState<string[]>([]);
  const [reminderSettingsMessage, setReminderSettingsMessage] = useState<string | null>(null);
  const [pendingActionKeys, setPendingActionKeys] = useState<string[]>([]);
  const [workspaceLoadFailed, setWorkspaceLoadFailed] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showMenuSheet, setShowMenuSheet] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notificationsViewed, setNotificationsViewed] = useState(false);
  const [theme, setTheme] = useState<ThemeMode>(() => {
    if (typeof document === "undefined") {
      return "system";
    }

    const savedTheme = document.documentElement.getAttribute("data-theme");
    return savedTheme === "dark" || savedTheme === "light" ? savedTheme : "system";
  });
  const [systemPrefersDark, setSystemPrefersDark] = useState(
    () =>
      typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches
  );

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
  const canManageActiveWorkspace =
    activeWorkspace?.role === "OWNER" && activeWorkspace.id !== transferredAwayWorkspaceId;
  const canWriteActiveWorkspace =
    activeWorkspace?.role === "OWNER" || activeWorkspace?.role === "EDITOR";
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
  const themeButtonLabel =
    theme === "system"
      ? `Тема: как на устройстве (сейчас ${systemPrefersDark ? "тёмная" : "светлая"})`
      : theme === "dark"
        ? "Тема: тёмная"
        : "Тема: светлая";

  useEffect(() => {
    if (!toastMessage) {
      return;
    }

    const timeoutId = window.setTimeout(() => setToastMessage(null), 4000);
    return () => window.clearTimeout(timeoutId);
  }, [toastMessage]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    function handleSystemThemeChange(event: MediaQueryListEvent) {
      setSystemPrefersDark(event.matches);
    }

    mediaQuery.addEventListener("change", handleSystemThemeChange);
    return () => mediaQuery.removeEventListener("change", handleSystemThemeChange);
  }, []);

  useEffect(() => {
    if (theme === "system") {
      document.documentElement.removeAttribute("data-theme");
      window.localStorage.removeItem(themeStorageKey);
      return;
    }

    document.documentElement.setAttribute("data-theme", theme);
    window.localStorage.setItem(themeStorageKey, theme);
  }, [theme]);

  useEffect(() => {
    let isMounted = true;

    getAuthProviders()
      .then((providers) => {
        if (isMounted) {
          setAuthProviders(providers);
        }
      })
      .catch(() => undefined);

    return () => {
      isMounted = false;
    };
  }, []);

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

        if (consumeInvitationAcceptedToast()) {
          setToastMessage("Приглашение принято — вы переключены на общий список.");
        }

        setToken(authToken);
        const [userProfile] = await Promise.all([getMe(authToken), refreshWorkspaces(authToken)]);
        const activeData = await refreshActiveData(authToken);
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

  async function refreshActiveData(authToken = token, sortMode: CategorySortMode = categorySortMode) {
    if (!authToken) {
      return {
        categories: [],
        items: [],
        shoppingList: [],
        groups: [],
        inAppReminders: []
      };
    }

    const [nextCategories, nextItems, nextShoppingList, nextGroups, nextInAppReminders] =
      await Promise.all([
        getCategories(authToken),
        getItems(authToken, { sort: sortMode }),
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
    setTransferredAwayWorkspaceId(null);
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
      setShowItemForm(false);
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

  async function handleCategorySortModeChange(mode: CategorySortMode) {
    if (!token || mode === categorySortMode) {
      return;
    }

    setCategorySortModeState(mode);
    setCategorySortMode(mode);
    await refreshActiveData(token, mode);
  }

  async function handleMoveItem(item: Item, direction: "up" | "down") {
    if (!token || !selectedCategory || categorySortMode === "status") {
      return;
    }

    const categoryItems = visibleItems;
    const index = categoryItems.findIndex((currentItem) => currentItem.id === item.id);
    if (index === -1) {
      return;
    }

    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= categoryItems.length) {
      return;
    }

    const actionKey = `item:reorder:${item.id}`;
    try {
      setError(null);
      setPendingAction(actionKey, true);

      const reorderedItems = [...categoryItems];
      const [movedItem] = reorderedItems.splice(index, 1);
      if (!movedItem) {
        return;
      }
      reorderedItems.splice(targetIndex, 0, movedItem);
      const itemIds = reorderedItems.map((currentItem) => currentItem.id);

      await reorderItems(token, selectedCategory.id, itemIds);
      await refreshActiveData(token);
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
      name: editingItemName.trim(),
      importance: editingItemImportance
    });
    setItems((current) =>
      current.map((currentItem) => (currentItem.id === updatedItem.id ? updatedItem : currentItem))
    );
    setEditingItemId(null);
    setEditingItemName("");
    setEditingItemImportance("NORMAL");
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

  function toggleTheme() {
    setTheme((current) =>
      current === "system" ? "light" : current === "light" ? "dark" : "system"
    );
  }

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
      const transfer = await transferWorkspaceOwnership(token, activeWorkspace.id, member.id);
      setWorkspaceMessage(`${memberName} теперь владелец списка "${activeWorkspace.name}".`);
      setWorkspaces((current) =>
        current.map((workspace) =>
          workspace.id === transfer.workspaceId
            ? {
                ...workspace,
                ownerId: transfer.ownerId,
                role: "EDITOR"
              }
            : workspace
        )
      );
      setWorkspaceMembers([]);
      setWorkspaceInvitations([]);
      setTransferredAwayWorkspaceId(transfer.workspaceId);
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

  return {
    // Auth / loading
    token,
    isLoading,
    loadingMessage,
    error,
    setError,
    email,
    setEmail,
    emailAuthMessage,
    devMagicLink,
    isRequestingMagicLink,
    isStartingGoogleSignIn,
    isStartingAppleSignIn,
    authProviders,
    toastMessage,
    setToastMessage,
    handleRequestMagicLink,
    handleStartGoogleSignIn,
    handleStartAppleSignIn,
    handleSignOut,

    // Data
    categories,
    items,
    archivedCategories,
    archivedItems,
    groups,
    shoppingList,
    inAppReminders,
    workspaces,
    activeWorkspaceId,
    workspaceMembers,
    workspaceInvitations,
    workspaceInviteEmail,
    setWorkspaceInviteEmail,
    workspaceMessage,
    workspaceAction,
    transferredAwayWorkspaceId,
    isLoadingWorkspaceAccess,
    devInvitationLink,
    recommendations,
    recommendationSourceItemName,
    recommendationSourceCategoryId,
    searchQuery,
    setSearchQuery,
    searchResults,
    hasSearched,
    showOnboarding,
    onboardingStep,
    setOnboardingStep,
    selectedStarterCategories,
    setSelectedStarterCategories,
    starterItems,
    setStarterItems,
    selectedCategoryId,
    setSelectedCategoryId,
    categorySortMode,
    selectedGroupId,
    setSelectedGroupId,
    activeTab,
    setActiveTab,
    showCategoryForm,
    setShowCategoryForm,
    showItemForm,
    setShowItemForm,
    categoryName,
    setCategoryName,
    itemName,
    setItemName,
    groupName,
    setGroupName,
    groupItemId,
    setGroupItemId,
    editingItemId,
    setEditingItemId,
    editingItemName,
    setEditingItemName,
    editingItemImportance,
    setEditingItemImportance,
    manualShoppingTitle,
    setManualShoppingTitle,
    manualShoppingCategoryId,
    setManualShoppingCategoryId,
    manualShoppingPriority,
    setManualShoppingPriority,
    editingShoppingId,
    setEditingShoppingId,
    editingShoppingTitle,
    setEditingShoppingTitle,
    checkSession,
    setCheckSession,
    pendingCheckItemName,
    reminderDrafts,
    savingReminderKeys,
    reminderSettingsMessage,
    pendingActionKeys,
    workspaceLoadFailed,
    showMenuSheet,
    setShowMenuSheet,
    showNotifications,
    setShowNotifications,
    notificationsViewed,
    setNotificationsViewed,
    theme,
    setTheme,
    systemPrefersDark,

    // Derived
    selectedCategory,
    selectedGroup,
    selectedGroupCheckItemCount,
    activeWorkspace,
    canManageActiveWorkspace,
    canWriteActiveWorkspace,
    showWorkspaceSwitcher,
    showShareEntryPoint,
    visibleItems,
    visibleRecommendations,
    starterCategoryOptions,
    archivedStandaloneItems,
    shoppingGroups,
    currentCheckItem,
    checkedCount,
    attentionItemsCount,
    urgentItems,
    notificationCount,
    itemReminders,
    categoryReminders,
    groupReminders,
    themeButtonLabel,

    // Actions
    refreshActiveData,
    refreshWorkspaces,
    handleRetryWorkspaceLoad,
    refreshWorkspaceAccess,
    refreshArchivedData,
    refreshActiveCheckSession,
    refreshRecommendations,
    handleCreateCategory,
    handleCreateItem,
    handleSetStatus,
    handleCategorySortModeChange,
    handleMoveItem,
    handleAcceptRecommendation,
    handleDismissRecommendation,
    handleHideSimilarRecommendations,
    handleCompleteShoppingListItem,
    handleCreateManualShoppingItem,
    handleUpdateManualShoppingItem,
    handleDeleteManualShoppingItem,
    handleUpdateItem,
    updateReminderDraft,
    setReminderSaving,
    setPendingAction,
    showBoughtToast,
    isActionPending,
    handleOpenReminder,
    handleSnoozeReminder,
    handleStartReminderCheck,
    handleSaveReminderSettingsGroup,
    handleArchiveItem,
    handleArchiveSelectedCategory,
    handleRestoreCategory,
    handleRestoreItem,
    handleDeleteArchivedCategory,
    handleDeleteArchivedItem,
    handleClearCompletedShoppingList,
    handleStartCategoryCheck,
    handleCreateGroup,
    handleArchiveSelectedGroup,
    handleAddGroupItem,
    handleRemoveGroupItem,
    handleStartGroupCheck,
    handleCheckStatus,
    handleCancelCheck,
    handleFinishOnboarding,
    handleSearchItems,
    clearSearchSession,
    clearWorkspaceScopedState,
    handleSelectTab,
    handleSelectMenuTab,
    handleBellClick,
    toggleTheme,
    handleSelectCategory,
    handleSelectWorkspace,
    handleCreateWorkspaceInvitation,
    handleRevokeWorkspaceInvitation,
    handleRemoveWorkspaceMember,
    handleTransferWorkspaceOwnership,
    handleExportUserData,
    handleDeleteAccount,
    resetClientSession
  };
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

export function formatWorkspaceMemberName(member: WorkspaceMember): string {
  return member.user.displayName ?? member.user.firstName ?? member.user.email ?? "Участник";
}
