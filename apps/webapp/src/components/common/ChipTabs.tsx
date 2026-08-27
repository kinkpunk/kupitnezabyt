"use client";

import React from "react";

export interface ChipTabsItem {
  id: string;
  label: string;
  warning?: boolean;
}

export interface ChipTabsProps {
  items: ChipTabsItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  ariaLabel?: string;
  emptyState?: React.ReactNode;
}

export function ChipTabs({
  items,
  selectedId,
  onSelect,
  ariaLabel = "Табы",
  emptyState = null
}: ChipTabsProps) {
  if (items.length === 0) {
    return <>{emptyState}</>;
  }

  return (
    <div aria-label={ariaLabel} className="ds-category-tabs" role="tablist">
      {items.map((item) => {
        const isActive = selectedId === item.id;

        return (
          <button
            aria-selected={isActive}
            className={
              isActive ? "ds-category-tab ds-category-tab--active" : "ds-category-tab"
            }
            key={item.id}
            role="tab"
            type="button"
            onClick={() => onSelect(item.id)}
          >
            <span>{item.label}</span>
            {item.warning ? (
              <span aria-hidden="true" className="ds-category-tab__warning" />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
