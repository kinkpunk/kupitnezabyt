"use client";

import { ChevronRight } from "lucide-react";
import React from "react";

import type { Item } from "../../lib/types";
import { uiStatusLabels, type UiItemStatus } from "../../lib/ui";

export interface HomeDashboardProps {
  items: Item[];
  categoryReminderCount: number;
  onOpenShopping: () => void;
  onOpenLowItems: () => void;
  onOpenChecks: () => void;
}

interface StatusMetric {
  tone: UiItemStatus;
  count: number;
}

function MetricRow({
  metric,
  onOpen
}: {
  metric: StatusMetric;
  onOpen?: (() => void) | undefined;
}) {
  const label = uiStatusLabels[metric.tone];
  const value = (
    <span className="ds-home-summary__row-value">
      <span
        className={`ds-home-summary__metric-value ds-home-summary__metric-value--${metric.tone}`}
      >
        {metric.count}
      </span>
      <ChevronRight
        aria-hidden="true"
        size={16}
        className={onOpen ? undefined : "ds-home-summary__chevron--hidden"}
      />
    </span>
  );
  const labelNode = (
    <span className="ds-home-summary__row-label">
      <span
        aria-hidden="true"
        className={`ds-home-summary__metric-dot ds-home-summary__metric-dot--${metric.tone}`}
      />
      {label}
    </span>
  );

  return (
    <li>
      {onOpen ? (
        <button
          className="ds-home-summary__row ds-home-summary__row--action"
          type="button"
          onClick={onOpen}
        >
          {labelNode}
          {value}
        </button>
      ) : (
        <div className="ds-home-summary__row">
          {labelNode}
          {value}
        </div>
      )}
    </li>
  );
}

export function HomeDashboard({
  items,
  categoryReminderCount,
  onOpenShopping,
  onOpenLowItems,
  onOpenChecks
}: HomeDashboardProps) {
  const counts: Record<UiItemStatus, number> = { ok: 0, warn: 0, bad: 0 };
  for (const item of items) {
    if (item.status === "IN_STOCK") {
      counts.ok += 1;
    } else if (item.status === "LOW") {
      counts.warn += 1;
    } else if (item.status === "NEED_BUY") {
      counts.bad += 1;
    }
  }
  const total = counts.ok + counts.warn + counts.bad;

  if (total === 0 && categoryReminderCount === 0) {
    return (
      <div className="ds-home-summary">
        <p className="ds-home-summary__ok">
          <span
            aria-hidden="true"
            className="ds-home-summary__metric-dot ds-home-summary__metric-dot--ok"
          />
          Всё в порядке
        </p>
      </div>
    );
  }

  const segments: { tone: UiItemStatus; count: number }[] = [
    { tone: "ok", count: counts.ok },
    { tone: "warn", count: counts.warn },
    { tone: "bad", count: counts.bad }
  ];

  return (
    <div className="ds-home-summary" aria-label="Сводка">
      {total > 0 ? (
        <div aria-hidden="true" className="ds-home-summary__bar">
          {segments.map((segment) =>
            segment.count > 0 ? (
              <span
                key={segment.tone}
                className={`ds-home-summary__bar-segment ds-home-summary__bar-segment--${segment.tone}`}
                style={{ flexGrow: segment.count }}
              />
            ) : null
          )}
        </div>
      ) : null}
      <ul className="ds-home-summary__list">
        {total > 0 ? (
          <>
            <MetricRow metric={{ tone: "ok", count: counts.ok }} />
            <MetricRow
              metric={{ tone: "warn", count: counts.warn }}
              onOpen={counts.warn > 0 ? onOpenLowItems : undefined}
            />
            <MetricRow
              metric={{ tone: "bad", count: counts.bad }}
              onOpen={counts.bad > 0 ? onOpenShopping : undefined}
            />
          </>
        ) : null}
        {categoryReminderCount > 0 ? (
          <li>
            <button
              className="ds-home-summary__row ds-home-summary__row--action"
              type="button"
              onClick={onOpenChecks}
            >
              <span className="ds-home-summary__row-label">
                <span
                  aria-hidden="true"
                  className="ds-home-summary__metric-dot ds-home-summary__metric-dot--check"
                />
                К проверке
              </span>
              <span className="ds-home-summary__row-value">
                <span className="ds-home-summary__metric-value ds-home-summary__metric-value--check">
                  {categoryReminderCount}
                </span>
                <ChevronRight aria-hidden="true" size={16} />
              </span>
            </button>
          </li>
        ) : null}
      </ul>
    </div>
  );
}

