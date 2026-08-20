"use client";

import { Home, Menu, Tags } from "lucide-react";
import React from "react";
import type { LucideIcon } from "lucide-react";

import type { ActiveTab } from "../hooks/useAppState";

const navTabs: { id: ActiveTab; icon: LucideIcon; label: string }[] = [
  { id: "home", icon: Home, label: "Главная" },
  { id: "items", icon: Tags, label: "Категории" }
];

const menuTabIds: ActiveTab[] = ["shopping", "groups", "settings", "archive"];

export function BottomNav({
  activeTab,
  showMenuSheet,
  onSelectTab,
  onToggleMenu
}: {
  activeTab: ActiveTab;
  showMenuSheet: boolean;
  onSelectTab: (tab: ActiveTab) => void;
  onToggleMenu: () => void;
}) {
  const isMenuActive = showMenuSheet || menuTabIds.includes(activeTab);

  return (
    <nav aria-label="Основные разделы" className="bottom-nav">
      {navTabs.map((tab) => {
        const Icon = tab.icon;

        return (
          <button
            aria-current={activeTab === tab.id ? "page" : undefined}
            className={activeTab === tab.id ? "active" : ""}
            key={tab.id}
            type="button"
            onClick={() => onSelectTab(tab.id)}
          >
            <Icon aria-hidden="true" size={22} strokeWidth={2} />
            <span>{tab.label}</span>
          </button>
        );
      })}
      <button
        aria-controls="menu-sheet"
        aria-expanded={isMenuActive}
        aria-label="Меню"
        className={isMenuActive ? "active" : ""}
        type="button"
        onClick={onToggleMenu}
      >
        <Menu aria-hidden="true" size={22} strokeWidth={2} />
        <span>Меню</span>
      </button>
    </nav>
  );
}
