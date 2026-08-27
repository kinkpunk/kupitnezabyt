"use client";

import React, { type ReactNode } from "react";

export interface SectionHeaderProps {
  title: string;
  subtitle?: string | undefined;
  actions?: ReactNode;
}

export function SectionHeader({ title, subtitle, actions }: SectionHeaderProps) {
  return (
    <div className="ds-section-header">
      <div className="ds-section-header__text">
        <h2 className="ds-section-header__title">{title}</h2>
        {subtitle ? <p className="ds-section-header__subtitle">{subtitle}</p> : null}
      </div>
      {actions ? <div className="ds-section-header__actions">{actions}</div> : null}
    </div>
  );
}
