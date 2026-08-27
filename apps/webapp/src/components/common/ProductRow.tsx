"use client";

import { EllipsisVertical, GripVertical } from "lucide-react";
import React, { type MouseEvent, type ReactNode } from "react";

import { Button } from "../ui/Button";
import { StatusChip } from "../ui/StatusChip";
import type { UiItemStatus } from "../../lib/ui";

export interface ProductRowProps {
  title: string;
  subtitle?: string | undefined;
  meta?: ReactNode;
  status?: UiItemStatus | "paused" | undefined;
  onStatusClick?: (() => void) | undefined;
  actions?: ReactNode;
  onClick?: (() => void) | undefined;
  reorderHandle?: boolean;
}

export function ProductRow({
  title,
  subtitle,
  meta,
  status,
  onStatusClick,
  actions,
  onClick,
  reorderHandle = false
}: ProductRowProps) {
  const handleClick = (event: MouseEvent<HTMLDivElement>) => {
    if (onClick) {
      event.preventDefault();
      onClick();
    }
  };

  return (
    <div
      className="ds-product-row"
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={handleClick}
      onKeyDown={(event) => {
        if (onClick && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          onClick();
        }
      }}
    >
      {reorderHandle ? (
        <span className="ds-product-row__reorder" aria-hidden="true">
          <GripVertical size={18} />
        </span>
      ) : null}
      <div className="ds-product-row__info">
        <span className="ds-product-row__name">{title}</span>
        {subtitle ? <span className="ds-product-row__subtitle">{subtitle}</span> : null}
        {meta ? <div className="ds-product-row__meta">{meta}</div> : null}
      </div>
      <div className="ds-product-row__actions">
        {status === "paused" ? (
          <span className="ds-status-chip ds-status-chip--paused">
            <span className="ds-status-chip__dot" />
            <span className="ds-status-chip__label">Пауза</span>
          </span>
        ) : status ? (
          <StatusChip
            disabled={!onStatusClick}
            status={status}
            onCycle={onStatusClick ?? (() => {})}
          />
        ) : null}
        {actions}
      </div>
    </div>
  );
}

export interface ProductRowActionsProps {
  children: ReactNode;
}

export function ProductRowActions({ children }: ProductRowActionsProps) {
  return <div className="ds-product-row__actions">{children}</div>;
}

export interface ProductRowMoreButtonProps {
  onClick: () => void;
}

export function ProductRowMoreButton({ onClick }: ProductRowMoreButtonProps) {
  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onClick();
  };

  return (
    <Button
      aria-label="Ещё"
      size="compact"
      title="Ещё"
      variant="icon"
      onClick={handleClick}
    >
      <EllipsisVertical aria-hidden="true" size={18} />
    </Button>
  );
}
