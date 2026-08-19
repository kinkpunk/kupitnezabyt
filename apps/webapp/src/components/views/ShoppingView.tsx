"use client";

import type { ShoppingPriority } from "@kupitnezabyt/shared";

import { formatError } from "../../lib/format";
import type { Category, ShoppingListEntry } from "../../lib/types";

export function ShoppingView({
  shoppingList,
  shoppingGroups,
  categories,
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
  onCreateManualShoppingItem,
  onUpdateManualShoppingItem,
  onDeleteManualShoppingItem,
  onCompleteShoppingListItem,
  onClearCompletedShoppingList,
  setError,
  isActionPending
}: {
  shoppingList: ShoppingListEntry[];
  shoppingGroups: { id: string; title: string; entries: ShoppingListEntry[] }[];
  categories: Category[];
  manualShoppingTitle: string;
  setManualShoppingTitle: (value: string) => void;
  manualShoppingCategoryId: string;
  setManualShoppingCategoryId: (value: string) => void;
  manualShoppingPriority: ShoppingPriority;
  setManualShoppingPriority: (value: ShoppingPriority) => void;
  editingShoppingId: string | null;
  setEditingShoppingId: (value: string | null) => void;
  editingShoppingTitle: string;
  setEditingShoppingTitle: (value: string) => void;
  onCreateManualShoppingItem: () => Promise<void>;
  onUpdateManualShoppingItem: (entry: ShoppingListEntry) => Promise<void>;
  onDeleteManualShoppingItem: (entry: ShoppingListEntry) => Promise<void>;
  onCompleteShoppingListItem: (entry: ShoppingListEntry) => Promise<void>;
  onClearCompletedShoppingList: () => Promise<void>;
  setError: (message: string | null) => void;
  isActionPending: (key: string) => boolean;
}) {
  return (
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
            void onClearCompletedShoppingList().catch((caughtError) =>
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
          void onCreateManualShoppingItem().catch((caughtError) =>
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
                        void onUpdateManualShoppingItem(entry).catch((caughtError) =>
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
                      <span
                        className={
                          entry.priority === "URGENT" ? "badge badge-urgent" : "badge badge-muted"
                        }
                      >
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
                            void onDeleteManualShoppingItem(entry).catch((caughtError) =>
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
                        void onCompleteShoppingListItem(entry).catch((caughtError) =>
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
  );
}
