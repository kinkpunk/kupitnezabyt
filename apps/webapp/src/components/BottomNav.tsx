"use client";

import { Archive, Boxes, Home, Menu, Settings, ShoppingCart, Tags } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import type { ActiveTab } from "../hooks/useAppState";

const navTabs: { id: ActiveTab; icon: LucideIcon; label: string }[] = [
  { id: "home", icon: Home, label: "Главная" },
  { id: "items", icon: Tags, label: "Категории" }
];

const menuTabs: { id: ActiveTab; icon: LucideIcon; label: string }[] = [
  { id: "shopping", icon: ShoppingCart, label: "Покупки" },
  { id: "groups", icon: Boxes, label: "Наборы" },
  { id: "settings", icon: Settings, label: "Настройки" },
  { id: "archive", icon: Archive, label: "Архив" }
];

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
  return (
    <nav className="bottom-nav" aria-label="Основные разделы">
      {navTabs.map((tab) => {
        const Icon = tab.icon;

        return (
          <button
            className={activeTab === tab.id ? "active" : ""}
            key={tab.id}
            type="button"
            onClick={() => onSelectTab(tab.id)}
          >
            <Icon aria-hidden="true" size={18} strokeWidth={2.25} />
            <span>{tab.label}</span>
          </button>
        );
      })}
      <button
        aria-controls="menu-sheet"
        aria-expanded={showMenuSheet}
        className={
          showMenuSheet || menuTabs.some((tab) => tab.id === activeTab) ? "active" : ""
        }
        type="button"
        onClick={onToggleMenu}
      >
        <Menu aria-hidden="true" size={18} strokeWidth={2.25} />
        <span>Меню</span>
      </button>
    </nav>
  );
}
