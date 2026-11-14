"use client";

import { ChevronsUpDown } from "lucide-react";
import React, {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent
} from "react";

import type { UiItemStatus } from "../../lib/ui";
import { nextUiStatus, uiStatusCycle, uiStatusLabels } from "../../lib/ui";

export interface StatusChipProps {
  status: UiItemStatus;
  onCycle: () => void;
  /** Прямой выбор статуса из меню шеврона; без пропса чип остаётся одинарным. */
  onSelect?: ((status: UiItemStatus) => void) | undefined;
  disabled?: boolean;
}

interface MenuPosition {
  top: number;
  left: number;
}

const MENU_WIDTH = 148;
const MENU_HEIGHT = 128;
const MENU_GAP = 6;
const VIEWPORT_MARGIN = 8;

export function StatusChip({ status, onCycle, onSelect, disabled = false }: StatusChipProps) {
  const rootRef = useRef<HTMLSpanElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const [menu, setMenu] = useState<MenuPosition | null>(null);

  useEffect(() => {
    if (!menu) {
      return;
    }
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (
        rootRef.current &&
        event.target instanceof Node &&
        !rootRef.current.contains(event.target)
      ) {
        setMenu(null);
      }
    };
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenu(null);
        toggleRef.current?.focus();
      }
    };
    const closeOnViewportChange = () => setMenu(null);
    const closeOnFocusOut = (event: FocusEvent) => {
      const nextTarget = event.relatedTarget;
      if (
        rootRef.current &&
        !(nextTarget instanceof Node && rootRef.current.contains(nextTarget))
      ) {
        setMenu(null);
      }
    };
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);
    document.addEventListener("focusout", closeOnFocusOut, true);
    window.addEventListener("scroll", closeOnViewportChange, true);
    window.addEventListener("resize", closeOnViewportChange);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
      document.removeEventListener("focusout", closeOnFocusOut, true);
      window.removeEventListener("scroll", closeOnViewportChange, true);
      window.removeEventListener("resize", closeOnViewportChange);
    };
  }, [menu]);

  const handleCycleClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onCycle();
  };

  const openMenu = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (menu) {
      setMenu(null);
      return;
    }
    const rect = rootRef.current?.getBoundingClientRect();
    if (!rect) {
      return;
    }
    const fitsBelow = rect.bottom + MENU_GAP + MENU_HEIGHT <= window.innerHeight - VIEWPORT_MARGIN;
    setMenu({
      top: fitsBelow
        ? rect.bottom + MENU_GAP
        : Math.max(VIEWPORT_MARGIN, rect.top - MENU_GAP - MENU_HEIGHT),
      left: Math.min(Math.max(VIEWPORT_MARGIN, rect.right - MENU_WIDTH), window.innerWidth - MENU_WIDTH - VIEWPORT_MARGIN)
    });
  };

  const handleSelect = (event: MouseEvent<HTMLButtonElement>, next: UiItemStatus) => {
    event.stopPropagation();
    onSelect?.(next);
    setMenu(null);
    toggleRef.current?.focus();
  };

  const handleMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") {
      return;
    }
    event.preventDefault();
    const buttons = Array.from(
      event.currentTarget.querySelectorAll<HTMLButtonElement>("[role='menuitemradio']")
    );
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const delta = event.key === "ArrowDown" ? 1 : -1;
    const next = buttons[(index + delta + buttons.length) % buttons.length];
    next?.focus();
  };

  const label = uiStatusLabels[status];
  const cycleLabel = `Статус: ${label}. Следующий: ${uiStatusLabels[nextUiStatus(status)]}.`;

  if (!onSelect) {
    return (
      <button
        aria-label={cycleLabel}
        className={`ds-status-chip ds-status-chip--${status}`}
        disabled={disabled}
        type="button"
        onClick={handleCycleClick}
      >
        <span aria-hidden="true" className={`ds-status-chip__dot ds-status-chip__dot--${status}`} />
        <span className="ds-status-chip__label">{label}</span>
        <ChevronsUpDown aria-hidden="true" className="ds-status-chip__cycle" size={13} />
      </button>
    );
  }

  return (
    <span
      ref={rootRef}
      className={`ds-status-chip ds-status-chip--split ds-status-chip--${status}`}
    >
      <button
        aria-label={cycleLabel}
        className="ds-status-chip__main"
        disabled={disabled}
        type="button"
        onClick={handleCycleClick}
      >
        <span aria-hidden="true" className={`ds-status-chip__dot ds-status-chip__dot--${status}`} />
        <span className="ds-status-chip__label">{label}</span>
      </button>
      <button
        ref={toggleRef}
        aria-expanded={menu ? "true" : "false"}
        aria-haspopup="menu"
        aria-label="Выбрать статус"
        className="ds-status-chip__toggle"
        disabled={disabled}
        type="button"
        onClick={openMenu}
      >
        <ChevronsUpDown aria-hidden="true" size={13} />
      </button>
      {menu ? (
        <div
          className="ds-status-chip__menu"
          role="menu"
          style={{ left: menu.left, top: menu.top }}
          onKeyDown={handleMenuKeyDown}
        >
          {uiStatusCycle.map((option) => (
            <button
              key={option}
              aria-checked={option === status}
              className="ds-status-chip__menu-item"
              role="menuitemradio"
              type="button"
              onClick={(event) => handleSelect(event, option)}
            >
              <span aria-hidden="true" className={`ds-status-chip__dot ds-status-chip__dot--${option}`} />
              {uiStatusLabels[option]}
            </button>
          ))}
        </div>
      ) : null}
    </span>
  );
}
