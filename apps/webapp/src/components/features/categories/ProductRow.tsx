"use client";

import { EllipsisVertical } from "lucide-react";
import React, { type MouseEvent } from "react";

import { Button } from "../../ui/Button";
import { StatusChip } from "../../ui/StatusChip";
import type { UiItemStatus } from "../../../lib/ui";

export interface ProductRowProps {
  name: string;
  subtitle: string;
  status: UiItemStatus | "paused";
  onStatusClick: () => void;
  onMoreClick: () => void;
}

export function ProductRow({
  name,
  subtitle,
  status,
  onStatusClick,
  onMoreClick
}: ProductRowProps) {
  const handleMoreClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onMoreClick();
  };

  return (
    <div className="ds-product-row">
      <div className="ds-product-row__info">
        <span className="ds-product-row__name">{name}</span>
        <span className="ds-product-row__subtitle">{subtitle}</span>
      </div>
      <div className="ds-product-row__actions">
        {status === "paused" ? (
          <span className="ds-status-chip ds-status-chip--paused">
            <span className="ds-status-chip__dot" />
            <span className="ds-status-chip__label">Пауза</span>
          </span>
        ) : (
          <StatusChip status={status} onCycle={onStatusClick} />
        )}
        <Button
          aria-label="Действия"
          className="ds-button--icon--small"
          title="Действия"
          variant="icon"
          onClick={handleMoreClick}
        >
          <EllipsisVertical aria-hidden="true" size={18} />
        </Button>
      </div>
    </div>
  );
}
