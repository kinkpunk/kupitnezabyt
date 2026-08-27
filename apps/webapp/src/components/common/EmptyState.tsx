"use client";

import type { LucideIcon } from "lucide-react";
import React, { type ReactNode } from "react";

import { Button } from "../ui/Button";

export interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  children?: ReactNode;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  children
}: EmptyStateProps) {
  return (
    <div className="ds-empty-state">
      {Icon ? (
        <span className="ds-empty-state__icon" aria-hidden="true">
          <Icon size={40} strokeWidth={1.5} />
        </span>
      ) : null}
      <p className="ds-empty-state__title">{title}</p>
      {description ? <p className="ds-empty-state__description">{description}</p> : null}
      {actionLabel && onAction ? (
        <Button className="ds-empty-state__action" variant="primary" onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
      {children}
    </div>
  );
}
