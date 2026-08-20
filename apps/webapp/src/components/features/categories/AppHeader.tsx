"use client";

import { Bell } from "lucide-react";
import React from "react";

import { Badge } from "../../ui/Badge";
import { BrandWord } from "../../ui/BrandWord";
import { Button } from "../../ui/Button";

export interface AppHeaderProps {
  notificationCount: number;
  onBellClick: () => void;
}

export function AppHeader({ notificationCount, onBellClick }: AppHeaderProps) {
  return (
    <header className="ds-app-header">
      <div className="ds-app-header__brand">
        <img alt="" className="ds-app-header__logo" src="/logo.png" />
        <span className="ds-app-header__wordmark">
          <BrandWord />
        </span>
      </div>
      <Button
        aria-label="Уведомления"
        className="ds-button--icon--small"
        title="Уведомления"
        variant="icon"
        onClick={onBellClick}
      >
        <Bell aria-hidden="true" size={20} />
        <Badge count={notificationCount} />
      </Button>
    </header>
  );
}
