"use client";

import { calculateReadiness } from "@kupitnezabyt/shared";
import type { ItemStatus, ShoppingPriority } from "@kupitnezabyt/shared";
import type { CategoryStatus } from "@kupitnezabyt/shared";
import {
  Archive,
  Boxes,
  Home,
  ListChecks,
  Search,
  Settings,
  ShoppingCart,
  Tags
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
  clearCompletedShoppingList,
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
  getArchivedCategories,
  getArchivedItems,
  getCategories,
  getGroups,
  getItems,
  getRecommendations,
  getShoppingList,
  login,
  removeGroupItem,
  restoreCategory,
  restoreItem,
  searchItems,
  setItemStatus,
  setCheckSessionItemStatus,
  startCategoryCheckSession,
  startGroupCheckSession,
  updateItem,
  updateShoppingListItem
} from "../lib/api";
import type {
  Category,
  CheckSession,
  Item,
  ItemGroup,
  RecommendationSuggestion,
  ShoppingListEntry
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

const onboardingStorageKey = "kupitnezabyt.onboarding.completed";
const starterCategories = ["Еда", "Аптека", "Косметика", "Бытовая химия", "Дом"];
const starterItemHints = ["Кофе", "Ибупрофен", "Шампунь", "Стиральный порошок", "Рис"];

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
  { id: "items", icon: Tags, label: "Категории" },
  { id: "shopping", icon: ShoppingCart, label: "Покупки" },
  { id: "check", icon: ListChecks, label: "Проверка" },
  { id: "search", icon: Search, label: "Поиск" },
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
  const [recommendations, setRecommendations] = useState<RecommendationSuggestion[]>([]);
  const [recommendationSourceItemName, setRecommendationSourceItemName] = useState<string | null>(
    null
  );
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
  const [starterItems, setStarterItems] = useState(["Кофе", "Ибупрофен", "Шампунь"]);
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
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const selectedCategory = useMemo(
    () => categories.find((category) => category.id === selectedCategoryId) ?? categories[0],
    [categories, selectedCategoryId]
  );

  const selectedGroup = useMemo(
    () => groups.find((group) => group.id === selectedGroupId) ?? groups[0],
    [groups, selectedGroupId]
  );

  const visibleItems = useMemo(
    () =>
      selectedCategory
        ? items.filter((item) => item.categoryId === selectedCategory.id)
        : [],
    [items, selectedCategory]
  );

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

  const checkedCount = checkSession?.items.filter((sessionItem) => sessionItem.checkedAt).length ?? 0;

  const readiness = useMemo(() => calculateReadiness(items), [items]);

  const urgentItems = useMemo(
    () => items.filter((item) => item.status === "URGENT" || item.status === "NEED_BUY").slice(0, 5),
    [items]
  );

  const upcomingChecks = useMemo(() => {
    return items
      .filter((item) => item.nextCheckAt)
      .sort((first, second) =>
        String(first.nextCheckAt).localeCompare(String(second.nextCheckAt))
      )
      .slice(0, 5);
  }, [items]);

  useEffect(() => {
    let isMounted = true;

    async function boot() {
      try {
        const authToken = await login();
        if (!isMounted) {
          return;
        }

        setToken(authToken);
        await refreshData(authToken);
        setShowOnboarding(window.localStorage.getItem(onboardingStorageKey) !== "true");
      } catch (caughtError) {
        if (isMounted) {
          setError(formatError(caughtError));
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

  async function refreshData(authToken = token) {
    if (!authToken) {
      return;
    }

    const [
      nextCategories,
      nextItems,
      nextArchivedCategories,
      nextArchivedItems,
      nextShoppingList,
      nextGroups
    ] = await Promise.all([
      getCategories(authToken),
      getItems(authToken),
      getArchivedCategories(authToken),
      getArchivedItems(authToken),
      getShoppingList(authToken),
      getGroups(authToken)
    ]);

    setCategories(nextCategories);
    setItems(nextItems);
    setArchivedCategories(nextArchivedCategories);
    setArchivedItems(nextArchivedItems);
    setShoppingList(nextShoppingList);
    setGroups(nextGroups);
  }

  async function refreshRecommendations(authToken: string, item: Item) {
    const nextRecommendations = await getRecommendations(authToken, item.id);
    setRecommendations(nextRecommendations);
    setRecommendationSourceItemName(nextRecommendations.length ? item.name : null);
  }

  async function handleCreateCategory() {
    if (!token || !categoryName.trim()) {
      return;
    }

    setError(null);
    const category = await createCategory(token, categoryName.trim());
    setCategoryName("");
    setShowCategoryForm(false);
    setCategories((current) => [...current, category]);
    setSelectedCategoryId(category.id);
  }

  async function handleCreateItem() {
    if (!token || !selectedCategory || !itemName.trim()) {
      return;
    }

    setError(null);
    const item = await createItem(token, {
      categoryId: selectedCategory.id,
      name: itemName.trim()
    });
    setItemName("");
    setItems((current) => [...current, item]);
    await refreshData(token);
    await refreshRecommendations(token, item);
  }

  async function handleSetStatus(item: Item, status: ItemStatus) {
    if (!token) {
      return;
    }

    setError(null);
    const updatedItem = await setItemStatus(token, item.id, status);
    setItems((current) =>
      current.map((currentItem) => (currentItem.id === updatedItem.id ? updatedItem : currentItem))
    );
    await refreshData(token);
    await refreshRecommendations(token, updatedItem);
  }

  async function handleAcceptRecommendation(recommendation: RecommendationSuggestion) {
    if (!token) {
      return;
    }

    if (!window.confirm(`Добавить "${recommendation.suggestedItem}"?`)) {
      return;
    }

    setError(null);
    const item = await acceptRecommendation(token, recommendation.id);
    await refreshData(token);
    await refreshRecommendations(token, item);
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
    setRecommendationSourceItemName((currentName) =>
      recommendations.length <= 1 ? null : currentName
    );
  }

  async function handleCompleteShoppingListItem(entry: ShoppingListEntry) {
    if (!token) {
      return;
    }

    setError(null);
    const completedEntry = await completeShoppingListItem(token, entry.id);
    await refreshData(token);
    if (completedEntry.item) {
      await refreshRecommendations(token, completedEntry.item);
    }
  }

  async function handleCreateManualShoppingItem() {
    if (!token || !manualShoppingTitle.trim()) {
      return;
    }

    setError(null);
    await createShoppingListItem(token, {
      title: manualShoppingTitle.trim(),
      categoryId: manualShoppingCategoryId || null,
      priority: manualShoppingPriority
    });
    setManualShoppingTitle("");
    setManualShoppingCategoryId("");
    setManualShoppingPriority("NORMAL");
    await refreshData(token);
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
    await refreshData(token);
  }

  async function handleDeleteManualShoppingItem(entry: ShoppingListEntry) {
    if (!token || !window.confirm(`Удалить "${entry.title}" из списка покупок?`)) {
      return;
    }

    setError(null);
    await deleteShoppingListItem(token, entry.id);
    await refreshData(token);
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
    await refreshData(token);
  }

  async function handleArchiveItem(item: Item) {
    if (!token || !window.confirm(`Архивировать "${item.name}"?`)) {
      return;
    }

    setError(null);
    await archiveItem(token, item.id);
    await refreshData(token);
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
    await refreshData(token);
  }

  async function handleRestoreCategory(category: Category) {
    if (!token) {
      return;
    }

    setError(null);
    const restoredCategory = await restoreCategory(token, category.id);
    setSelectedCategoryId(restoredCategory.id);
    setActiveTab("items");
    await refreshData(token);
  }

  async function handleRestoreItem(item: Item) {
    if (!token) {
      return;
    }

    setError(null);
    const restoredItem = await restoreItem(token, item.id);
    setSelectedCategoryId(restoredItem.categoryId);
    setActiveTab("items");
    await refreshData(token);
  }

  async function handleDeleteArchivedCategory(category: Category) {
    if (!token || !window.confirm(`Удалить категорию "${category.name}" из архива навсегда?`)) {
      return;
    }

    setError(null);
    await deleteArchivedCategory(token, category.id);
    await refreshData(token);
  }

  async function handleDeleteArchivedItem(item: Item) {
    if (!token || !window.confirm(`Удалить товар "${item.name}" из архива навсегда?`)) {
      return;
    }

    setError(null);
    await deleteArchivedItem(token, item.id);
    await refreshData(token);
  }

  async function handleClearCompletedShoppingList() {
    if (!token) {
      return;
    }

    setError(null);
    await clearCompletedShoppingList(token);
    await refreshData(token);
  }

  async function handleStartCategoryCheck() {
    if (!token || !selectedCategory) {
      return;
    }

    setError(null);
    const session = await startCategoryCheckSession(token, selectedCategory.id);
    setCheckSession(session);
    setActiveTab("check");
  }

  async function handleCreateGroup() {
    if (!token || !groupName.trim()) {
      return;
    }

    setError(null);
    const group = await createGroup(token, groupName.trim());
    setGroupName("");
    setGroups((current) => [...current, group]);
    setSelectedGroupId(group.id);
  }

  async function handleArchiveSelectedGroup() {
    if (!token || !selectedGroup || !window.confirm(`Архивировать набор "${selectedGroup.name}"?`)) {
      return;
    }

    setError(null);
    await archiveGroup(token, selectedGroup.id);
    setSelectedGroupId(null);
    await refreshData(token);
  }

  async function handleAddGroupItem() {
    if (!token || !selectedGroup || !groupItemId) {
      return;
    }

    setError(null);
    const group = await addGroupItem(token, selectedGroup.id, groupItemId);
    setGroups((current) => current.map((itemGroup) => (itemGroup.id === group.id ? group : itemGroup)));
    setGroupItemId("");
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
    const session = await startGroupCheckSession(token, selectedGroup.id);
    setCheckSession(session);
    setActiveTab("check");
  }

  async function handleCheckStatus(status: ItemStatus) {
    if (!token || !checkSession || !currentCheckItem) {
      return;
    }

    setError(null);
    const session = await setCheckSessionItemStatus(
      token,
      checkSession.id,
      currentCheckItem.itemId,
      status
    );
    setCheckSession(session);

    if (session.items.every((sessionItem) => sessionItem.checkedAt)) {
      const completedSession = await completeCheckSession(token, session.id);
      setCheckSession(completedSession);
      await refreshData(token);
    } else {
      await refreshData(token);
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
      const createdCategories: Category[] = [];

      for (const name of selectedStarterCategories) {
        if (!existingCategoryNames.has(name)) {
          createdCategories.push(await createCategory(token, name));
        }
      }

      const nextCategories = createdCategories.length
        ? [...categories, ...createdCategories]
        : categories;
      const firstCategory = nextCategories[0];
      if (firstCategory) {
        for (const name of starterItems.map((item) => item.trim()).filter(Boolean).slice(0, 5)) {
          await createItem(token, {
            categoryId: firstCategory.id,
            name
          });
        }
      }
    }

    window.localStorage.setItem(onboardingStorageKey, "true");
    setShowOnboarding(false);
    setOnboardingStep(0);
    await refreshData(token);
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
    clearSavedToken();
    setToken(null);
    setCategories([]);
    setItems([]);
    setGroups([]);
    setShoppingList([]);
    setRecommendations([]);
    setSearchResults([]);
    setHasSearched(false);
    window.localStorage.removeItem(onboardingStorageKey);
    setActiveTab("home");
  }

  if (isLoading) {
    return <main className="app-shell centered">Загрузка...</main>;
  }

  if (showOnboarding) {
    return (
      <main className="app-shell onboarding-shell">
        <ErrorNotice message={error} onClose={() => setError(null)} />
        <section className="onboarding-panel">
          <p className="eyebrow">Шаг {onboardingStep + 1} из 4</p>

          {onboardingStep === 0 ? (
            <>
              <h1>kupitnezabyt</h1>
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
                  onClick={() => setSelectedStarterCategories([])}
                >
                  Пропустить
                </button>
              </div>
            </>
          ) : onboardingStep === 2 ? (
            <>
              <h1>Первые товары</h1>
              <p>Добавьте 3-5 вещей, которые обычно заканчиваются.</p>
              <div className="starter-items">
                {starterItems.map((value, index) => (
                  <input
                    aria-label={`Стартовый товар ${index + 1}`}
                    key={index}
                    placeholder={starterItemHints[index] ?? "Товар"}
                    value={value}
                    onChange={(event) =>
                      setStarterItems((current) =>
                        current.map((item, itemIndex) =>
                          itemIndex === index ? event.target.value : item
                        )
                      )
                    }
                  />
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
                Я буду присылать напоминания в Telegram, когда пора проверить
                запасы. Это не системное push-разрешение: сообщения отправляет бот.
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
        <div>
          <p className="eyebrow">Mini App</p>
          <h1>kupitnezabyt</h1>
        </div>
        <span className="counter">{shoppingList.length}</span>
      </header>

      <ErrorNotice message={error} onClose={() => setError(null)} />

      <nav className="tabs" aria-label="Основные разделы">
        {navTabs.map((tab) => {
          const Icon = tab.icon;

          return (
            <button
              className={activeTab === tab.id ? "active" : ""}
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
            >
              <Icon aria-hidden="true" size={18} strokeWidth={2.25} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {activeTab === "home" ? (
        <section className="stack">
          <div className="home-summary">
            <div>
              <p className="eyebrow">Готовность</p>
              <strong>{readiness === null ? "Нет данных" : `${readiness}%`}</strong>
              <span>{items.length ? `${items.length} отслеживаемых` : "Добавьте первые товары"}</span>
            </div>
            <div>
              <p className="eyebrow">Покупки</p>
              <strong>{shoppingList.length}</strong>
              <span>{shoppingList.length ? "активных позиций" : "список пуст"}</span>
            </div>
          </div>

          <section className="quick-actions" aria-label="Быстрые действия">
            <button type="button" onClick={() => setActiveTab("items")}>
              Категории
            </button>
            <button type="button" onClick={() => setActiveTab("shopping")}>
              Покупки
            </button>
            <button type="button" onClick={() => setActiveTab("check")}>
              Проверка
            </button>
            <button className="ghost-button" type="button" onClick={() => setActiveTab("search")}>
              Поиск
            </button>
            <button className="ghost-button" type="button" onClick={() => setActiveTab("groups")}>
              Наборы
            </button>
          </section>

          <section className="home-section">
            <div className="section-heading">
              <div>
                <h2>Срочно и купить</h2>
                <p>{urgentItems.length ? `${urgentItems.length} поз.` : "Пока спокойно"}</p>
              </div>
            </div>
            {urgentItems.length ? (
              <div className="item-list">
                {urgentItems.map((item) => (
                  <article className="shopping-row" key={item.id}>
                    <div>
                      <p className={item.status === "URGENT" ? "urgent" : "normal"}>
                        {statusLabels[item.status]}
                      </p>
                      <h2>{item.name}</h2>
                    </div>
                    <button
                      className="ghost-button"
                      type="button"
                      onClick={() => {
                        setSelectedCategoryId(item.categoryId);
                        setActiveTab("items");
                      }}
                    >
                      Открыть
                    </button>
                  </article>
                ))}
              </div>
            ) : (
              <p className="empty">Нет товаров, которые нужно купить прямо сейчас.</p>
            )}
          </section>

          <section className="home-section">
            <div className="section-heading">
              <div>
                <h2>Ближайшие проверки</h2>
                <p>{upcomingChecks.length ? `${upcomingChecks.length} поз.` : "Нет дат"}</p>
              </div>
            </div>
            {upcomingChecks.length ? (
              <div className="item-list">
                {upcomingChecks.map((item) => (
                  <article className="shopping-row" key={item.id}>
                    <div>
                      <p>{formatDate(item.nextCheckAt)}</p>
                      <h2>{item.name}</h2>
                      <span>{statusLabels[item.status]}</span>
                    </div>
                    <button
                      className="ghost-button"
                      type="button"
                      onClick={() => {
                        setSelectedCategoryId(item.categoryId);
                        setActiveTab("items");
                      }}
                    >
                      Открыть
                    </button>
                  </article>
                ))}
              </div>
            ) : (
              <p className="empty">Добавьте циклы проверки, чтобы видеть ближайшие даты.</p>
            )}
          </section>

          <section className="home-section">
            <div className="section-heading">
              <div>
                <h2>Категории</h2>
                <p>{categories.length ? `${categories.length} активных` : "Пока нет"}</p>
              </div>
            </div>
            <div className="category-row" aria-label="Быстрый доступ к категориям">
              {categories.map((category) => (
                <button
                  className="category"
                  key={category.id}
                  type="button"
                  onClick={() => {
                    setSelectedCategoryId(category.id);
                    setActiveTab("items");
                  }}
                >
                  <span>{category.icon ? `${category.icon} ` : ""}{category.name}</span>
                  <small>
                    {categoryStatusLabels[category.aggregateStatus]} · {category.itemCount}
                  </small>
                </button>
              ))}
            </div>
          </section>
        </section>
      ) : activeTab === "items" ? (
        <section className="stack">
          <div className="section-heading">
            <div>
              <h2>Категории</h2>
              <p>{categories.length ? `${categories.length} активных` : "Пока нет"}</p>
            </div>
            <button
              className="ghost-button"
              type="button"
              onClick={() => setShowCategoryForm((current) => !current)}
            >
              {showCategoryForm ? "Скрыть" : "Новая"}
            </button>
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
                onChange={(event) => setCategoryName(event.target.value)}
              />
              <button type="submit">Создать</button>
            </form>
          ) : null}

          <div className="category-row" aria-label="Категории">
            {categories.map((category) => (
              <button
                className={selectedCategory?.id === category.id ? "category active" : "category"}
                key={category.id}
                type="button"
                onClick={() => {
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
            <>
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
                  onChange={(event) => setItemName(event.target.value)}
                />
                <button type="submit">Добавить</button>
              </form>

              {recommendations.length ? (
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
                    {recommendations.map((recommendation) => (
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
                            type="button"
                            onClick={() =>
                              void handleAcceptRecommendation(recommendation).catch(
                                (caughtError) => setError(formatError(caughtError))
                              )
                            }
                          >
                            Добавить
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
                            <p>{statusLabels[item.status]}</p>
                          </div>
                          <div className="icon-actions">
                            <button
                              className="ghost-button"
                              type="button"
                              onClick={() => {
                                setEditingItemId(item.id);
                                setEditingItemName(item.name);
                              }}
                            >
                              Изм.
                            </button>
                            <button
                              className="ghost-button danger-button"
                              type="button"
                              onClick={() =>
                                void handleArchiveItem(item).catch((caughtError) =>
                                  setError(formatError(caughtError))
                                )
                              }
                            >
                              Архив
                            </button>
                          </div>
                        </div>
                      )}
                      <div className="status-grid">
                        {statusOptions.map((status) => (
                          <button
                            className={item.status === status ? "active" : ""}
                            key={status}
                            type="button"
                            onClick={() =>
                              void handleSetStatus(item, status).catch((caughtError) =>
                                setError(formatError(caughtError))
                              )
                            }
                          >
                            {statusLabels[status]}
                          </button>
                        ))}
                      </div>
                    </article>
                  ))
                ) : (
                  <p className="empty">Добавьте первый товар в эту категорию.</p>
                )}
              </div>
            </>
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
              onChange={(event) => setManualShoppingTitle(event.target.value)}
            />
            <select
              aria-label="Категория покупки"
              value={manualShoppingCategoryId}
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
              onChange={(event) => setManualShoppingPriority(event.target.value as ShoppingPriority)}
            >
              <option value="NORMAL">Купить</option>
              <option value="URGENT">Срочно</option>
            </select>
            <button type="submit">Добавить</button>
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
                          <p className={entry.priority === "URGENT" ? "urgent" : "normal"}>
                            {entry.priority === "URGENT" ? "Срочно" : "Купить"}
                          </p>
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
                          onClick={() =>
                            void handleCompleteShoppingListItem(entry).catch((caughtError) =>
                              setError(formatError(caughtError))
                            )
                          }
                        >
                          Куплено
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
              onChange={(event) => setGroupName(event.target.value)}
            />
            <button type="submit">Добавить</button>
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
                <button type="submit">Добавить</button>
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
                onChange={(event) => setSelectedCategoryId(event.target.value)}
              >
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
              <button type="submit" disabled={!selectedCategory}>
                Начать
              </button>
            </form>
          ) : null}

          {checkSession?.status === "COMPLETED" ? (
            <p className="empty">Проверка завершена.</p>
          ) : checkSession?.status === "CANCELLED" ? (
            <p className="empty">Проверка отменена.</p>
          ) : currentCheckItem ? (
            <article className="check-card">
              <p className="eyebrow">
                {checkSession?.category?.name ?? checkSession?.group?.name ?? "Проверка"}
              </p>
              <h2>{currentCheckItem.item.name}</h2>
              <div className="status-grid">
                {statusOptions.map((status) => (
                  <button
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
              Выберите категорию и начните пошаговую проверку.
            </p>
          )}
        </section>
      ) : activeTab === "search" ? (
        <section className="stack">
          <div className="section-heading">
            <div>
              <h2>Поиск</h2>
              <p>Название, бренд, заметки или категория</p>
            </div>
          </div>

          <form
            className="inline-form"
            onSubmit={(event) => {
              event.preventDefault();
              void handleSearchItems().catch((caughtError) => setError(formatError(caughtError)));
            }}
          >
            <input
              aria-label="Поиск товаров"
              placeholder="Например, кофе"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
            <button type="submit">Найти</button>
          </form>

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
              <p>Экспорт и удаление данных</p>
            </div>
          </div>

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
    </main>
  );
}

function formatError(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Что-то пошло не так.";
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

function formatDate(value: string | null): string {
  if (!value) {
    return "Дата не задана";
  }

  return new Intl.DateTimeFormat("ru", {
    day: "2-digit",
    month: "short"
  }).format(new Date(value));
}
