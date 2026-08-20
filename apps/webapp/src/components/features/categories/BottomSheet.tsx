"use client";

import { X } from "lucide-react";
import React, { type ReactNode } from "react";

import { Button } from "../../ui/Button";

export interface BottomSheetProps {
  show: boolean;
  title?: string;
  onClose: () => void;
  children: ReactNode;
}

export function BottomSheet({ show, title, onClose, children }: BottomSheetProps) {
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
        className="ds-bottom-sheet"
        role="dialog"
        onClick={(event) => event.stopPropagation()}
      >
        <div aria-hidden="true" className="ds-bottom-sheet__handle" />
        {title ? (
          <div className="ds-bottom-sheet__header">
            <strong>{title}</strong>
            <Button
              aria-label="Закрыть"
              className="ds-button--icon--small"
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
