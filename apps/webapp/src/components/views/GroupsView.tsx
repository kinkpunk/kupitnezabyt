"use client";

import { Package, PackagePlus, Trash2 } from "lucide-react";
import React from "react";

import { formatError } from "../../lib/format";
import type { Item, ItemGroup } from "../../lib/types";
import { itemStatusToUiStatus } from "../../lib/ui";
import { ChipTabs, EmptyState, ProductRow, SectionHeader } from "../common";
import { Button } from "../ui/Button";

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
  function handleCreateGroup(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void onCreateGroup().catch((caughtError) => setError(formatError(caughtError)));
  }

  function handleAddItem(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void onAddGroupItem().catch((caughtError) => setError(formatError(caughtError)));
  }

  function handleStartCheck() {
    void onStartGroupCheck().catch((caughtError) => setError(formatError(caughtError)));
  }

  function handleArchiveGroup() {
    void onArchiveSelectedGroup().catch((caughtError) => setError(formatError(caughtError)));
  }

  function handleRemoveItem(itemId: string) {
    void onRemoveGroupItem(itemId).catch((caughtError) => setError(formatError(caughtError)));
  }

  function getItemStatus(item: Item): "ok" | "warn" | "bad" | "paused" {
    if (item.status === "PAUSED") {
      return "paused";
    }

    return itemStatusToUiStatus(item.status) ?? "paused";
  }

  function renderGroupActions() {
    if (!selectedGroup) {
      return null;
    }

    return (
      <div className="ds-row-actions">
        <Button
          disabled={selectedGroupCheckItemCount === 0}
          size="compact"
          variant="primary"
          onClick={handleStartCheck}
        >
          Проверить
        </Button>
        <Button
          className="ds-button--danger"
          size="compact"
          variant="ghost"
          onClick={handleArchiveGroup}
        >
          Архив
        </Button>
      </div>
    );
  }

  const availableItems = selectedGroup
    ? items.filter((item) => !selectedGroup.items.some((groupItem) => groupItem.itemId === item.id))
    : items;

  return (
    <section className="stack">
      <SectionHeader
        title="Наборы"
        subtitle={groups.length ? `${groups.length} создано` : "Пока нет"}
      />

      <form className="ds-groups-create-form" onSubmit={handleCreateGroup}>
        <input
          aria-label="Название набора"
          disabled={isActionPending("group:create")}
          placeholder="Новый набор"
          value={groupName}
          onChange={(event) => setGroupName(event.target.value)}
        />
        <Button disabled={isActionPending("group:create") || !groupName.trim()} type="submit">
          {isActionPending("group:create") ? "Добавляем..." : "Добавить"}
        </Button>
      </form>

      <ChipTabs
        ariaLabel="Наборы"
        items={groups.map((group) => ({
          id: group.id,
          label: `${group.icon ? `${group.icon} ` : ""}${group.name}`
        }))}
        selectedId={selectedGroup?.id ?? null}
        onSelect={onSelectGroup}
      />

      {selectedGroup ? (
        <>
          <SectionHeader
            actions={renderGroupActions()}
            subtitle={`${selectedGroup.items.length} поз.`}
            title={selectedGroup.name}
          />

          <form className="ds-groups-add-form" onSubmit={handleAddItem}>
            <select
              aria-label="Товар для набора"
              disabled={isActionPending("group:item:add")}
              value={groupItemId}
              onChange={(event) => setGroupItemId(event.target.value)}
            >
              <option value="">Выберите товар</option>
              {availableItems.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            <Button
              disabled={isActionPending("group:item:add") || !groupItemId}
              type="submit"
            >
              {isActionPending("group:item:add") ? "Добавляем..." : "Добавить"}
            </Button>
          </form>

          {selectedGroup.items.length ? (
            <div className="ds-product-list">
              {selectedGroup.items.map((groupItem) => (
                <ProductRow
                  key={groupItem.id}
                  actions={
                    <Button
                      className="ds-button--danger"
                      size="compact"
                      variant="ghost"
                      onClick={() => handleRemoveItem(groupItem.itemId)}
                    >
                      <Trash2 aria-hidden="true" size={16} />
                      Убрать
                    </Button>
                  }
                  status={getItemStatus(groupItem.item)}
                  title={groupItem.item.name}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              description="Добавьте товары в набор для совместной проверки"
              icon={PackagePlus}
              title="Набор пуст"
            />
          )}
        </>
      ) : (
        <EmptyState
          description="Создайте набор для совместной проверки товаров"
          icon={Package}
          title="Нет выбранного набора"
        />
      )}
    </section>
  );
}
