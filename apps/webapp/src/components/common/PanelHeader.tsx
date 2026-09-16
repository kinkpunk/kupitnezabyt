"use client";

import React from "react";

import { Button } from "../ui/Button";
import { ProgressBar } from "../ui/ProgressBar";

export interface PanelHeaderProps {
  total: number;
  inStock: number;
  needBuy: number;
  low: number;
  onArchive: () => void;
  onCheck: () => void;
  disabled?: boolean;
}

export function PanelHeader({
  total,
  inStock,
  needBuy,
  low,
  onArchive,
  onCheck,
  disabled = false
}: PanelHeaderProps) {
  let label = "ОК";
  if (total === 0) {
    label = "Пусто";
  } else if (needBuy > 0) {
    label = `Купить · ${needBuy} из ${total}`;
  } else if (low > 0) {
    label = `Мало · ${low} из ${total}`;
  }

  return (
    <div className="ds-panel-header">
      <div className="ds-panel-header__top">
        <span className="ds-panel-header__label">{label}</span>
        <div className="ds-panel-header__actions">
          <button
            aria-label="Архив"
            className="ds-panel-header__archive"
            disabled={disabled}
            type="button"
            onClick={onArchive}
          >
            Архив
          </button>
          <Button
            className="ds-button--compact"
            disabled={disabled}
            variant="primary"
            onClick={onCheck}
          >
            Проверить
          </Button>
        </div>
      </div>
      <ProgressBar done={inStock} total={total} />
    </div>
  );
}
