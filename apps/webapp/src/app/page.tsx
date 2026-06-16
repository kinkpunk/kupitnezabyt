"use client";

import type { ItemStatus } from "@kupitnezabyt/shared";
import type { CategoryStatus } from "@kupitnezabyt/shared";
import { useEffect, useMemo, useState } from "react";

import {
  ApiError,
  archiveCategory,
  archiveItem,
  clearCompletedShoppingList,
  completeShoppingListItem,
  createCategory,
  createItem,
  getCategories,
  getItems,
  getShoppingList,
  login,
  setItemStatus,
  updateItem
} from "../lib/api";
import type { Category, Item, ShoppingListEntry } from "../lib/types";

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
  const [activeTab, setActiveTab] = useState<"items" | "shopping">("items");
  const [categoryName, setCategoryName] = useState("");
  const [itemName, setItemName] = useState("");
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingItemName, setEditingItemName] = useState("");
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
      ) : (
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
          {shoppingList.length ? (
            shoppingList.map((entry) => (
              <article className="shopping-row" key={entry.id}>
                <div>
                  <p className={entry.priority === "URGENT" ? "urgent" : "normal"}>
                    {entry.priority === "URGENT" ? "Срочно" : "Купить"}
                  </p>
                  <h2>{entry.title}</h2>
                  <span>{entry.category?.name ?? "Без категории"}</span>
                </div>
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
              </article>
            ))
          ) : (
            <p className="empty">Список покупок пуст.</p>
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
