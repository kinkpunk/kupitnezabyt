"use client";

import type { CategoryStatus } from "@kupitnezabyt/shared";
import React from "react";

import { categoryTriggerItemStatus } from "../../../lib/ui";

export interface CategoryTabsProps {
  categories: { id: string; name: string; aggregateStatus: CategoryStatus }[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function CategoryTabs({ categories, selectedId, onSelect }: CategoryTabsProps) {
  if (categories.length === 0) {
    return null;
  }

  return (
    <div
      aria-label="Категории"
      className="ds-category-tabs"
      role="tablist"
    >
      {categories.map((category) => {
        const isActive = selectedId === category.id;
        const hasWarning = categoryTriggerItemStatus[category.aggregateStatus] !== null;

        return (
          <button
            aria-selected={isActive}
            className={
              isActive
                ? "ds-category-tab ds-category-tab--active"
                : "ds-category-tab"
            }
            key={category.id}
            role="tab"
            type="button"
            onClick={() => onSelect(category.id)}
          >
            <span>{category.name}</span>
            {hasWarning ? (
              <span
                aria-hidden="true"
                className="ds-category-tab__warning"
              />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
