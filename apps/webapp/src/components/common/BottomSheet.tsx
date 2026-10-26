"use client";

import { X } from "lucide-react";
import React, { type ReactNode, useEffect, useRef } from "react";

import { Button } from "../ui/Button";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export interface BottomSheetProps {
  show: boolean;
  title?: string;
  id?: string;
  onClose: () => void;
  children: ReactNode;
}

export function BottomSheet({ show, title, id, onClose, children }: BottomSheetProps) {
  const sheetRef = useRef<HTMLElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!show) {
      return;
    }

    const trigger = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const sheet = sheetRef.current;
    const initialFocus = (() => {
      const focusables = sheet?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      const first = focusables?.[0];
      return first ?? sheet;
    })();
    initialFocus?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onCloseRef.current();
        return;
      }

      if (event.key !== "Tab" || !sheet) {
        return;
      }

      const focusables = Array.from(sheet.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      if (focusables.length === 0) {
        event.preventDefault();
        sheet.focus();
        return;
      }

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && (active === first || !sheet.contains(active))) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && (active === last || !sheet.contains(active))) {
        event.preventDefault();
        first?.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      if (trigger instanceof HTMLElement && document.contains(trigger)) {
        trigger.focus();
      }
    };
  }, [show]);

  if (!show) {
    return null;
  }

  return (
    <div
      className="ds-bottom-sheet-overlay"
      role="presentation"
      onClick={onClose}
    >
      <section
        aria-label={title}
        aria-modal="true"
        className="ds-bottom-sheet"
        id={id}
        role="dialog"
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        ref={sheetRef}
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
