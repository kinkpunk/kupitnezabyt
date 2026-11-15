"use client";

import React from "react";

export interface AppLoadingSkeletonProps {
  message?: string;
}

export function AppLoadingSkeleton({ message = "Загрузка..." }: AppLoadingSkeletonProps) {
  const tabModifiers = ["", "--short", "--long", ""];
  const rowModifiers = ["", "--short", "--long", "", "--short", "--long"];

  return (
    <main className="app-shell" aria-busy="true">
      <p className="ds-visually-hidden" role="status">
        {message}
      </p>
      <header className="app-loading__header" aria-hidden="true">
        <span className="ds-skeleton app-loading__logo" />
        <span className="ds-skeleton app-loading__header-title" />
        <span className="ds-skeleton app-loading__menu" />
      </header>
      <div className="main-content app-loading__content" aria-hidden="true">
        <div className="app-loading__search" />
        <div className="app-loading__tabs">
          {tabModifiers.map((modifier, index) => (
            <span className={`ds-skeleton app-loading__tab${modifier}`} key={index} />
          ))}
          <span className="ds-skeleton app-loading__tab-add" />
        </div>
        <div className="app-loading__panel">
          <span className="ds-skeleton app-loading__panel-action app-loading__panel-action--wide" />
          <span className="ds-skeleton app-loading__panel-action" />
          <span className="ds-skeleton app-loading__panel-icon app-loading__panel-icon--filters" />
          <span className="ds-skeleton app-loading__panel-icon" />
        </div>
        <div className="app-loading__rows">
          {rowModifiers.map((modifier, index) => (
            <div className="app-loading__row" key={index}>
              <div className="app-loading__row-info">
                <span className={`ds-skeleton app-loading__row-title${modifier}`} />
                <span className="ds-skeleton app-loading__row-subtitle" />
              </div>
              <span className="ds-skeleton app-loading__row-chip" />
              <span className="ds-skeleton app-loading__row-more" />
            </div>
          ))}
        </div>
      </div>
      <nav className="app-loading__nav" aria-hidden="true">
        {Array.from({ length: 3 }, (_, index) => (
          <span className="ds-skeleton app-loading__nav-item" key={index} />
        ))}
      </nav>
    </main>
  );
}
