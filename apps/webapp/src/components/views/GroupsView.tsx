"use client";

import { formatError } from "../../lib/format";
import type { Item, ItemGroup } from "../../lib/types";
import { statusLabels } from "../../lib/ui";

export function GroupsView({
  groups,
  selectedGroup,
  groupName,
  setGroupName,
  groupItemId,
  setGroupItemId,
  items,
  selectedGroupCheckItemCount,
  onCreateGroup,
  onArchiveSelectedGroup,
  onAddGroupItem,
  onRemoveGroupItem,
  onStartGroupCheck,
  onSelectGroup,
  setError,
  isActionPending
}: {
  groups: ItemGroup[];
  selectedGroup: ItemGroup | null | undefined;
  groupName: string;
  setGroupName: (value: string) => void;
  groupItemId: string;
  setGroupItemId: (value: string) => void;
  items: Item[];
  selectedGroupCheckItemCount: number;
  onCreateGroup: () => Promise<void>;
  onArchiveSelectedGroup: () => Promise<void>;
  onAddGroupItem: () => Promise<void>;
  onRemoveGroupItem: (itemId: string) => Promise<void>;
  onStartGroupCheck: () => Promise<void>;
  onSelectGroup: (groupId: string) => void;
  setError: (message: string | null) => void;
  isActionPending: (key: string) => boolean;
}) {
  return (
    <section className="stack">
      <form
        className="inline-form"
        onSubmit={(event) => {
          event.preventDefault();
          void onCreateGroup().catch((caughtError) => setError(formatError(caughtError)));
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
            onClick={() => onSelectGroup(group.id)}
          >
            <span>
              {group.icon ? `${group.icon} ` : ""}
              {group.name}
            </span>
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
                  void onStartGroupCheck().catch((caughtError) =>
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
                  void onArchiveSelectedGroup().catch((caughtError) =>
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
              void onAddGroupItem().catch((caughtError) => setError(formatError(caughtError)));
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
                      void onRemoveGroupItem(groupItem.itemId).catch((caughtError) =>
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
  );
}
