"use client";

import { Archive, MoreVertical, Plus, SlidersHorizontal } from "lucide-react";
import React from "react";

import { Button } from "../ui/Button";
import { BottomSheet } from "./BottomSheet";

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
  onAddItem?: (() => void) | undefined;
  disabled?: boolean;
  archiveDisabled?: boolean;
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
  onAddItem,
  disabled = false,
  archiveDisabled = false
}: PanelHeaderProps) {
  const [expanded, setExpanded] = React.useState(false);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const allChips: FilterChip[] = [
    { id: "all", label: "Все", count: total },
    { id: "in_stock", label: "Есть", count: inStock, dot: "ok" },
    { id: "low", label: "Мало", count: low, dot: "warn" },
    { id: "need_buy", label: "Нет", count: needBuy, dot: "bad" }
  ];
  const chips = allChips.filter((chip) => chip.id === "all" || chip.count > 0);

  return (
    <div className="ds-panel-header">
      <div className="ds-panel-header__row">
        <div className="ds-panel-header__row-actions">
          {onAddItem ? (
            <Button
              aria-label="Добавить товар"
              className="ds-button--compact ds-panel-header__add"
              variant="ghost"
              onClick={onAddItem}
            >
              <Plus aria-hidden="true" size={18} />
              <span aria-hidden="true" className="ds-panel-header__add-label">
                <span className="ds-panel-header__add-label-full">Добавить товар</span>
                <span className="ds-panel-header__add-label-short">Товар</span>
              </span>
            </Button>
          ) : null}
          <Button
            className="ds-button--compact"
            disabled={disabled}
            variant="ghost"
            onClick={onCheck}
          >
            Проверить
          </Button>
        </div>
        <div className="ds-panel-header__row-tools">
          <Button
            aria-expanded={expanded}
            aria-label="Фильтры"
            className="ds-panel-header__toggle"
            size="compact"
            title="Фильтры"
            variant="icon"
            onClick={() => setExpanded((current) => !current)}
          >
            <SlidersHorizontal aria-hidden="true" size={18} />
            {filter !== "all" ? (
              <span aria-hidden="true" className="ds-panel-header__toggle-dot" />
            ) : null}
          </Button>
          <Button
            aria-expanded={menuOpen}
            aria-label="Ещё"
            disabled={archiveDisabled}
            size="compact"
            title="Ещё"
            variant="icon"
            onClick={() => setMenuOpen(true)}
          >
            <MoreVertical aria-hidden="true" size={18} />
          </Button>
        </div>
      </div>
      {expanded && chips.length > 1 ? (
        <div className="ds-panel-header__panel">
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
        </div>
      ) : null}
      <BottomSheet
        show={menuOpen}
        title="Действия с категорией"
        onClose={() => setMenuOpen(false)}
      >
        <div className="ds-bottom-sheet__actions">
          <button
            className="ds-bottom-sheet__action ds-bottom-sheet__action--danger"
            type="button"
            onClick={() => {
              setMenuOpen(false);
              onArchive();
            }}
          >
            <Archive aria-hidden="true" size={18} />
            В архив
          </button>
        </div>
      </BottomSheet>
    </div>
  );
}
