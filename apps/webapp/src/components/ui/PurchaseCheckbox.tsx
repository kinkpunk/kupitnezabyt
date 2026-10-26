"use client";

import React, { type MouseEvent } from "react";

import { hapticImpactLight } from "../../lib/haptics";

export interface PurchaseCheckboxProps {
  pending?: boolean;
  onMark: () => void;
  label?: string;
  pendingLabel?: string;
}

export function PurchaseCheckbox({
  pending = false,
  onMark,
  label = "Куплено",
  pendingLabel = "Отмечаем..."
}: PurchaseCheckboxProps) {
  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    if (pending) {
      return;
    }

    hapticImpactLight();
    onMark();
  }

  return (
    <button
      type="button"
      className="ds-purchase-checkbox"
      disabled={pending}
      role="checkbox"
      aria-checked={false}
      aria-label={pending ? pendingLabel : label}
      onClick={handleClick}
    >
      <span className="ds-purchase-checkbox__label">
        {pending ? pendingLabel : label}
      </span>
      <span className="ds-purchase-checkbox__box" aria-hidden="true">
        {pending ? <span className="ds-purchase-checkbox__spinner" /> : null}
      </span>
    </button>
  );
}
