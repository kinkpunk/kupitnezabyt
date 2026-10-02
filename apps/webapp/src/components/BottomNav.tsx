"use client";

import { Boxes, Home, ShoppingCart, Tags } from "lucide-react";
import React from "react";
import type { LucideIcon } from "lucide-react";

import type { ActiveTab } from "../hooks/useAppState";

const navTabs: { id: ActiveTab; icon: LucideIcon; label: string }[] = [
  { id: "home", icon: Home, label: "Главная" },
  { id: "items", icon: Tags, label: "Категории" },
  { id: "shopping", icon: ShoppingCart, label: "Покупки" },
  { id: "groups", icon: Boxes, label: "Наборы" }
];

export function BottomNav({
  activeTab,
  onSelectTab
}: {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
}) {
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
    </nav>
  );
}
