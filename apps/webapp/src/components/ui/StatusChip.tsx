import React, { type MouseEvent } from "react";

import type { UiItemStatus } from "../../lib/ui";
import { uiStatusLabels } from "../../lib/ui";

export interface StatusChipProps {
  status: UiItemStatus;
  onCycle: () => void;
  disabled?: boolean;
}

export function StatusChip({ status, onCycle, disabled = false }: StatusChipProps) {
  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onCycle();
  };

  return (
    <button
      aria-label={`Статус: ${uiStatusLabels[status]}. Нажмите для смены.`}
      className={`ds-status-chip ds-status-chip--${status}`}
      disabled={disabled}
      type="button"
      onClick={handleClick}
    >
      <span aria-hidden="true" className="ds-status-chip__dot" />
      <span className="ds-status-chip__label">{uiStatusLabels[status]}</span>
    </button>
  );
}
