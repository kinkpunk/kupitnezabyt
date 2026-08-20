"use client";

import React from "react";

import { Button } from "../../ui/Button";
import { ProgressBar } from "../../ui/ProgressBar";

export interface PanelHeaderProps {
  done: number;
  total: number;
  onArchive: () => void;
  onCheck: () => void;
  disabled?: boolean;
}

export function PanelHeader({
  done,
  total,
  onArchive,
  onCheck,
  disabled = false
}: PanelHeaderProps) {
  return (
    <div className="ds-panel-header">
      <div className="ds-panel-header__top">
        <span className="ds-panel-header__label">
          Купить · {done} из {total}
        </span>
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
      <ProgressBar done={done} total={total} />
    </div>
  );
}
