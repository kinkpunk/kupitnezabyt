"use client";

import React, { type ReactNode } from "react";

export interface SectionHeaderProps {
  title: string;
  subtitle?: string | undefined;
  actions?: ReactNode;
  icon?: ReactNode;
  level?: 2 | 3;
}

export function SectionHeader({
  title,
  subtitle,
  actions,
  icon,
  level = 2
}: SectionHeaderProps) {
  const HeadingTag = level === 3 ? "h3" : "h2";

  return (
    <div className="ds-section-header">
      <div className="ds-section-header__text">
        <HeadingTag className="ds-section-header__title">
          {icon ? <span className="ds-section-header__icon">{icon}</span> : null}
          {title}
        </HeadingTag>
        {subtitle ? <p className="ds-section-header__subtitle">{subtitle}</p> : null}
      </div>
      {actions ? <div className="ds-section-header__actions">{actions}</div> : null}
    </div>
  );
}
