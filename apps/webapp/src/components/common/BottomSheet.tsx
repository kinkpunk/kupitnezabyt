"use client";

import { X } from "lucide-react";
import React, { type ReactNode } from "react";

import { Button } from "../ui/Button";

export interface BottomSheetProps {
  show: boolean;
  title?: string;
  id?: string;
  onClose: () => void;
  children: ReactNode;
}

export function BottomSheet({ show, title, id, onClose, children }: BottomSheetProps) {
  if (!show) {
    return null;
  }

  return (
    <div
      aria-modal="true"
      className="ds-bottom-sheet-overlay"
      role="presentation"
      onClick={onClose}
    >
      <section
        aria-label={title}
        className="ds-bottom-sheet"
        id={id}
        role="dialog"
        onClick={(event) => event.stopPropagation()}
      >
        <div aria-hidden="true" className="ds-bottom-sheet__handle" />
        {title ? (
          <div className="ds-bottom-sheet__header">
            <strong>{title}</strong>
            <Button
              aria-label="Закрыть"
              size="compact"
              variant="icon"
              onClick={onClose}
            >
              <X aria-hidden="true" size={18} />
            </Button>
          </div>
        ) : null}
        <div className="ds-bottom-sheet__content">{children}</div>
      </section>
    </div>
  );
}
