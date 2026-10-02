"use client";

import { Archive, Package, PackagePlus, Plus, Trash2 } from "lucide-react";
import React from "react";

import { formatError } from "../../lib/format";
import type { Item, ItemGroup } from "../../lib/types";
import { itemStatusToUiStatus } from "../../lib/ui";
import { BottomSheet, ChipTabs, EmptyState, ProductRow } from "../common";
import { Button } from "../ui/Button";

export function GroupsView({
  groups,
  selectedGroup,
  groupName,
  setGroupName,
  showGroupForm,
  setShowGroupForm,
  showGroupItemForm,
  setShowGroupItemForm,
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
  showGroupForm: boolean;
  setShowGroupForm: (value: boolean | ((current: boolean) => boolean)) => void;
  showGroupItemForm: boolean;
  setShowGroupItemForm: (value: boolean | ((current: boolean) => boolean)) => void;
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

  const availableItems = selectedGroup
    ? items.filter((item) => !selectedGroup.items.some((groupItem) => groupItem.itemId === item.id))
    : items;

  return (
    <section className="stack">
      <BottomSheet
        show={showGroupForm}
        title="Новый набор"
        onClose={() => setShowGroupForm(false)}
      >
        <form
          className="ds-bottom-sheet__create-form"
          onSubmit={(event) => {
            event.preventDefault();
            void onCreateGroup().catch((caughtError) => setError(formatError(caughtError)));
          }}
        >
          <input
            aria-label="Название набора"
            disabled={isActionPending("group:create")}
            placeholder="Название набора"
            value={groupName}
            onChange={(event) => setGroupName(event.target.value)}
          />
          <Button
            type="submit"
            disabled={isActionPending("group:create") || !groupName.trim()}
          >
            {isActionPending("group:create") ? "Создаем..." : "Создать"}
          </Button>
        </form>
      </BottomSheet>

      <BottomSheet
        show={showGroupItemForm}
        title="Добавить товар в набор"
        onClose={() => setShowGroupItemForm(false)}
      >
        <form
          className="ds-bottom-sheet__create-form"
          onSubmit={(event) => {
            event.preventDefault();
            void onAddGroupItem().catch((caughtError) => setError(formatError(caughtError)));
          }}
        >
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
            type="submit"
            disabled={isActionPending("group:item:add") || !groupItemId}
          >
            {isActionPending("group:item:add") ? "Добавляем..." : "Добавить"}
          </Button>
        </form>
      </BottomSheet>

      <ChipTabs
        ariaLabel="Наборы"
        items={groups.map((group) => ({
          id: group.id,
          label: `${group.icon ? `${group.icon} ` : ""}${group.name}`
        }))}
        selectedId={selectedGroup?.id ?? null}
        trailing={
          <Button
            aria-label="Новый набор"
            size="compact"
            title="Новый набор"
            variant="icon"
            onClick={() => setShowGroupForm(true)}
          >
            <Plus aria-hidden="true" size={18} />
          </Button>
        }
        onSelect={onSelectGroup}
      />

      {selectedGroup ? (
        <>
          <div className="ds-panel-header">
            <div className="ds-panel-header__row">
              <div className="ds-panel-header__row-actions">
                <Button
                  className="ds-button--compact"
                  disabled={selectedGroupCheckItemCount === 0}
                  variant="primary"
                  onClick={handleStartCheck}
                >
                  Проверить
                </Button>
                <button
                  aria-label="В архив"
                  className="ds-panel-header__archive"
                  type="button"
                  onClick={handleArchiveGroup}
                >
                  <Archive aria-hidden="true" size={18} />
                  В архив
                </button>
              </div>
            </div>
          </div>

          <div className="ds-product-list">
            {selectedGroup.items.length ? (
              selectedGroup.items.map((groupItem) => (
                <ProductRow
                  key={groupItem.id}
                  actions={
                    <Button
                      aria-label="Убрать"
                      className="ds-button--danger"
                      size="compact"
                      title="Убрать"
                      variant="icon"
                      onClick={() => handleRemoveItem(groupItem.itemId)}
                    >
                      <Trash2 aria-hidden="true" size={18} />
                    </Button>
                  }
                  status={getItemStatus(groupItem.item)}
                  title={groupItem.item.name}
                />
              ))
            ) : (
              <EmptyState
                description="Добавьте товары в набор для совместной проверки"
                icon={PackagePlus}
                title="Набор пуст"
              />
            )}
            <button
              className="ds-add-item-row"
              type="button"
              onClick={() => setShowGroupItemForm(true)}
            >
              <Plus aria-hidden="true" size={18} />
              Добавить товар
            </button>
          </div>
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
