"use client";

import type { ItemStatus, ShoppingPriority } from "@kupitnezabyt/shared";
import type { CategoryStatus } from "@kupitnezabyt/shared";
import { useEffect, useMemo, useState } from "react";

import {
  ApiError,
  archiveCategory,
  archiveItem,
  cancelCheckSession,
  clearCompletedShoppingList,
  completeCheckSession,
  completeShoppingListItem,
  createCategory,
  createItem,
  createShoppingListItem,
  deleteShoppingListItem,
  getCategories,
  getItems,
  getShoppingList,
  login,
  setItemStatus,
  setCheckSessionItemStatus,
  startCategoryCheckSession,
  updateItem,
  updateShoppingListItem
} from "../lib/api";
import type { Category, CheckSession, Item, ShoppingListEntry } from "../lib/types";

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

export default function HomePage() {
  const [token, setToken] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [shoppingList, setShoppingList] = useState<ShoppingListEntry[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"check" | "items" | "shopping">("items");
  const [categoryName, setCategoryName] = useState("");
  const [itemName, setItemName] = useState("");
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

  const visibleItems = useMemo(
    () =>
      selectedCategory
        ? items.filter((item) => item.categoryId === selectedCategory.id)
        : [],
    [items, selectedCategory]
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

    const [nextCategories, nextItems, nextShoppingList] = await Promise.all([
      getCategories(authToken),
      getItems(authToken),
      getShoppingList(authToken)
    ]);

    setCategories(nextCategories);
    setItems(nextItems);
    setShoppingList(nextShoppingList);
  }

  async function handleCreateCategory() {
    if (!token || !categoryName.trim()) {
      return;
    }

    setError(null);
    const category = await createCategory(token, categoryName.trim());
    setCategoryName("");
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
    setShoppingList(await getShoppingList(token));
  }

  async function handleCompleteShoppingListItem(entry: ShoppingListEntry) {
    if (!token) {
      return;
    }

    setError(null);
    await completeShoppingListItem(token, entry.id);
    await refreshData(token);
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

  if (isLoading) {
    return <main className="app-shell centered">Загрузка...</main>;
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

      {error ? <div className="notice">{error}</div> : null}

      <nav className="tabs" aria-label="Основные разделы">
        <button
          className={activeTab === "items" ? "active" : ""}
          type="button"
          onClick={() => setActiveTab("items")}
        >
          Категории
        </button>
        <button
          className={activeTab === "shopping" ? "active" : ""}
          type="button"
          onClick={() => setActiveTab("shopping")}
        >
          Покупки
        </button>
        <button
          className={activeTab === "check" ? "active" : ""}
          type="button"
          onClick={() => setActiveTab("check")}
        >
          Проверка
        </button>
      </nav>

      {activeTab === "items" ? (
        <section className="stack">
          <form
            className="inline-form"
            onSubmit={(event) => {
              event.preventDefault();
              void handleCreateCategory().catch((caughtError) => setError(formatError(caughtError)));
            }}
          >
            <input
              aria-label="Название категории"
              placeholder="Новая категория"
              value={categoryName}
              onChange={(event) => setCategoryName(event.target.value)}
            />
            <button type="submit">Добавить</button>
          </form>

          <div className="category-row" aria-label="Категории">
            {categories.map((category) => (
              <button
                className={selectedCategory?.id === category.id ? "category active" : "category"}
                key={category.id}
                type="button"
                onClick={() => setSelectedCategoryId(category.id)}
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
                className="inline-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  void handleCreateItem().catch((caughtError) => setError(formatError(caughtError)));
                }}
              >
                <input
                  aria-label="Название товара"
                  placeholder={`Товар в "${selectedCategory.name}"`}
                  value={itemName}
                  onChange={(event) => setItemName(event.target.value)}
                />
                <button type="submit">Добавить</button>
              </form>

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
      ) : (
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

          {checkSession?.status === "COMPLETED" ? (
            <p className="empty">Проверка завершена.</p>
          ) : checkSession?.status === "CANCELLED" ? (
            <p className="empty">Проверка отменена.</p>
          ) : currentCheckItem ? (
            <article className="check-card">
              <p className="eyebrow">{checkSession?.category?.name ?? "Категория"}</p>
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
              Откройте категорию и нажмите «Проверить», чтобы начать пошаговую проверку.
            </p>
          )}
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
