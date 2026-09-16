"use client";

import { Bell } from "lucide-react";
import React, { useEffect, useRef } from "react";

import { Badge } from "../ui/Badge";
import { BrandWord } from "../ui/BrandWord";
import { Button } from "../ui/Button";

export interface AppHeaderProps {
  notificationCount: number;
  onBellClick: () => void;
}

export function AppHeader({ notificationCount, onBellClick }: AppHeaderProps) {
  const headerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const header = headerRef.current;
    if (!header) return;

    // iOS standalone WebView keeps a stale low-res tile of the top area after
    // the launch animation; toggling opacity forces a re-rasterization.
    const forceRepaint = () => {
      header.style.opacity = "0.999";
      void header.offsetHeight;
      header.style.opacity = "";
      void header.offsetHeight;
    };

    const timer = window.setTimeout(forceRepaint, 600);
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        forceRepaint();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return (
    <header ref={headerRef} className="ds-app-header">
      <div className="ds-app-header__brand">
        <img alt="" className="ds-app-header__logo" src="/logo.png" />
        <span className="ds-app-header__wordmark">
          <BrandWord />
        </span>
      </div>
      <Button
        aria-label="Уведомления"
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
