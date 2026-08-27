"use client";

import { Plus } from "lucide-react";
import React from "react";

export interface FabProps {
  label?: string;
  onClick: () => void;
}

export function FAB({ label = "Добавить", onClick }: FabProps) {
  return (
    <button
      aria-label={label}
      className="ds-fab"
      type="button"
      onClick={onClick}
    >
      <Plus aria-hidden="true" size={24} />
    </button>
  );
}
