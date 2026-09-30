"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";

export interface ChipTabsItem {
  id: string;
  label: string;
  warning?: boolean;
}

export interface ChipTabsProps {
  items: ChipTabsItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  ariaLabel?: string;
  emptyState?: React.ReactNode;
  trailing?: React.ReactNode;
}

export function ChipTabs({
  items,
  selectedId,
  onSelect,
  ariaLabel = "Табы",
  emptyState = null,
  trailing = null
}: ChipTabsProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [hasHiddenBefore, setHasHiddenBefore] = useState(false);
  const [hasHiddenAfter, setHasHiddenAfter] = useState(false);

  const updateFades = useCallback(() => {
    const element = scrollRef.current;
    if (!element) {
      return;
    }
    setHasHiddenBefore(element.scrollLeft > 1);
    setHasHiddenAfter(element.scrollWidth - element.clientWidth - element.scrollLeft > 1);
  }, []);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) {
      return;
    }

    updateFades();
    element.addEventListener("scroll", updateFades);
    const resizeObserver =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(updateFades);
    resizeObserver?.observe(element);

    return () => {
      element.removeEventListener("scroll", updateFades);
      resizeObserver?.disconnect();
    };
  }, [items.length, updateFades]);

  if (items.length === 0) {
    return (
      <>
        {emptyState}
        {trailing ? (
          <div aria-label={ariaLabel} className="ds-category-tabs" role="tablist">
            {trailing}
          </div>
        ) : null}
      </>
    );
  }

  const wrapClassName = [
    "ds-category-tabs-wrap",
    hasHiddenBefore ? "ds-category-tabs-wrap--start" : "",
    hasHiddenAfter ? "ds-category-tabs-wrap--end" : ""
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={wrapClassName}>
      <div aria-label={ariaLabel} className="ds-category-tabs" ref={scrollRef} role="tablist">
        {items.map((item) => {
          const isActive = selectedId === item.id;

          return (
            <button
              aria-selected={isActive}
              className={
                isActive ? "ds-category-tab ds-category-tab--active" : "ds-category-tab"
              }
              key={item.id}
              role="tab"
              type="button"
              onClick={() => onSelect(item.id)}
            >
              <span>{item.label}</span>
              {item.warning ? (
                <span aria-hidden="true" className="ds-category-tab__warning" />
              ) : null}
            </button>
          );
        })}
        {trailing ? <div className="ds-category-tabs__trailing">{trailing}</div> : null}
      </div>
    </div>
  );
}
