"use client";

import { Bell, Moon, Search, Sun, SunMoon } from "lucide-react";

import type { ThemeMode } from "../lib/ui";
import { BrandWord } from "./ui/BrandWord";

export function TopBar({
  searchQuery,
  onSearchQueryChange,
  onSearch,
  theme,
  themeButtonLabel,
  onToggleTheme,
  notificationCount,
  notificationsViewed,
  onBellClick
}: {
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  onSearch: () => Promise<void>;
  theme: ThemeMode;
  themeButtonLabel: string;
  onToggleTheme: () => void;
  notificationCount: number;
  notificationsViewed: boolean;
  onBellClick: () => void;
}) {
  return (
    <header className="topbar">
      <div className="brand-lockup">
        <img alt="" className="brand-logo" src="/logo.png" />
        <h1>
          <BrandWord />
        </h1>
      </div>
      <form
        className="global-search"
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          void onSearch();
        }}
      >
        <input
          aria-label="Глобальный поиск"
          placeholder="Найти товар или категорию"
          value={searchQuery}
          onChange={(event) => onSearchQueryChange(event.target.value)}
        />
        <button type="submit" aria-label="Искать">
          <Search aria-hidden="true" size={18} />
        </button>
      </form>
      <button
        aria-label={themeButtonLabel}
        className="notification-bell"
        title={themeButtonLabel}
        type="button"
        onClick={onToggleTheme}
      >
        {theme === "system" ? (
          <SunMoon aria-hidden="true" size={20} />
        ) : theme === "dark" ? (
          <Moon aria-hidden="true" size={20} />
        ) : (
          <Sun aria-hidden="true" size={20} />
        )}
      </button>
      <button
        aria-controls="notification-sheet"
        aria-expanded={false}
        aria-label={
          notificationCount && !notificationsViewed
            ? `Уведомлений: ${notificationCount}`
            : "Уведомления: нет новых"
        }
        className="notification-bell"
        type="button"
        onClick={onBellClick}
      >
        <Bell aria-hidden="true" size={20} />
        {!notificationsViewed && notificationCount ? (
          <span className="notification-badge">{notificationCount}</span>
        ) : null}
      </button>
    </header>
  );
}
