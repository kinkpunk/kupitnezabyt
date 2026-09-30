"use client";

import { Archive, SlidersHorizontal } from "lucide-react";
import React from "react";

import { Button } from "../ui/Button";

export type CategoryStatusFilter = "all" | "in_stock" | "low" | "need_buy";

export interface PanelHeaderProps {
  total: number;
  inStock: number;
  needBuy: number;
  low: number;
  filter: CategoryStatusFilter;
  onFilterChange: (filter: CategoryStatusFilter) => void;
  onArchive: () => void;
  onCheck: () => void;
  disabled?: boolean;
}

interface FilterChip {
  id: CategoryStatusFilter;
  label: string;
  count: number;
  dot?: "ok" | "warn" | "bad";
}

export function PanelHeader({
  total,
  inStock,
  needBuy,
  low,
  filter,
  onFilterChange,
  onArchive,
  onCheck,
  disabled = false
}: PanelHeaderProps) {
  const [expanded, setExpanded] = React.useState(false);
  const allChips: FilterChip[] = [
    { id: "all", label: "Все", count: total },
    { id: "in_stock", label: "Есть", count: inStock, dot: "ok" },
    { id: "low", label: "Мало", count: low, dot: "warn" },
    { id: "need_buy", label: "Нет", count: needBuy, dot: "bad" }
  ];
  const chips = allChips.filter((chip) => chip.id === "all" || chip.count > 0);

  return (
    <div className="ds-panel-header">
      <Button
        aria-expanded={expanded}
        aria-label="Фильтры и действия"
        className="ds-panel-header__toggle"
        size="compact"
        variant="icon"
        onClick={() => setExpanded((current) => !current)}
      >
        <SlidersHorizontal aria-hidden="true" size={18} />
        {filter !== "all" ? (
          <span aria-hidden="true" className="ds-panel-header__toggle-dot" />
        ) : null}
      </Button>
      {expanded ? (
        <div className="ds-panel-header__panel">
          {chips.length > 1 ? (
            <div aria-label="Фильтр по статусу" className="ds-panel-header__filters" role="group">
              {chips.map((chip) => {
                const active = filter === chip.id;
                const className = [
                  "ds-filter-chip",
                  chip.dot ? `ds-filter-chip--${chip.dot}` : "",
                  active ? "ds-filter-chip--active" : ""
                ]
                  .filter(Boolean)
                  .join(" ");
                return (
                  <button
                    key={chip.id}
                    aria-pressed={active}
                    className={className}
                    type="button"
                    onClick={() => onFilterChange(chip.id)}
                  >
                    {chip.dot ? <span aria-hidden="true" className="ds-filter-chip__dot" /> : null}
                    <span className="ds-filter-chip__label">{chip.label}</span>
                    <span className="ds-filter-chip__count">{chip.count}</span>
                  </button>
                );
              })}
            </div>
          ) : null}
          <div className="ds-panel-header__actions">
            <button
              aria-label="Архив"
              className="ds-panel-header__archive"
              disabled={disabled}
              type="button"
              onClick={() => {
                setExpanded(false);
                onArchive();
              }}
            >
              <Archive aria-hidden="true" size={18} />
              В архив
            </button>
            <Button
              className="ds-button--compact"
              disabled={disabled}
              variant="primary"
              onClick={() => {
                setExpanded(false);
                onCheck();
              }}
            >
              Проверить
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
