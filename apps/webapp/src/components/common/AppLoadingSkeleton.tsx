"use client";

import React from "react";

export interface AppLoadingSkeletonProps {
  message?: string;
}

export function AppLoadingSkeleton({ message = "Загрузка..." }: AppLoadingSkeletonProps) {
  const rowTitles = ["", "--short", "--long", "", "--short"];

  return (
    <main className="app-shell" aria-busy="true">
      <p className="ds-visually-hidden" role="status">
        {message}
      </p>
      <header className="app-loading__header" aria-hidden="true">
        <span className="ds-skeleton app-loading__header-icon" />
        <span className="ds-skeleton app-loading__header-title" />
        <span className="ds-skeleton app-loading__header-icon" />
      </header>
      <div className="main-content app-loading__content" aria-hidden="true">
        <div className="app-loading__section">
          <span className="ds-skeleton app-loading__section-title" />
          {rowTitles.map((modifier, index) => (
            <div className="app-loading__row" key={index}>
              <span className={`ds-skeleton app-loading__row-title${modifier}`} />
              <span className="ds-skeleton app-loading__row-meta" />
              <span className="ds-skeleton app-loading__row-action" />
            </div>
          ))}
        </div>
        <div className="app-loading__section">
          <span className="ds-skeleton app-loading__section-title" />
          <div className="app-loading__row">
            <span className="ds-skeleton app-loading__row-title app-loading__row-title--long" />
            <span className="ds-skeleton app-loading__row-action" />
          </div>
          <div className="app-loading__row">
            <span className="ds-skeleton app-loading__row-title app-loading__row-title--short" />
            <span className="ds-skeleton app-loading__row-action" />
          </div>
        </div>
      </div>
      <nav className="app-loading__nav" aria-hidden="true">
        {Array.from({ length: 4 }, (_, index) => (
          <span className="ds-skeleton app-loading__nav-item" key={index} />
        ))}
      </nav>
    </main>
  );
}
