"use client";

import React from "react";
import { Archive, Boxes, Settings, ShoppingCart } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { BottomSheet } from "./common";
import type { ActiveTab } from "../hooks/useAppState";
import type { WorkspaceSummary } from "../lib/types";

const menuTabs: { id: ActiveTab; icon: LucideIcon; label: string }[] = [
  { id: "shopping", icon: ShoppingCart, label: "Покупки" },
  { id: "groups", icon: Boxes, label: "Наборы" },
  { id: "settings", icon: Settings, label: "Настройки" },
  { id: "archive", icon: Archive, label: "Архив" }
];

export function MenuSheet({
  show,
  activeWorkspace,
  workspaces,
  showWorkspaceSwitcher,
  activeTab,
  onClose,
  onSelectTab,
  onSelectWorkspace
}: {
  show: boolean;
  activeWorkspace: WorkspaceSummary | null;
  workspaces: WorkspaceSummary[];
  showWorkspaceSwitcher: boolean;
  activeTab: ActiveTab;
  onClose: () => void;
  onSelectTab: (tab: ActiveTab) => void;
  onSelectWorkspace: (workspaceId: string) => Promise<void>;
}) {
  return (
    <BottomSheet show={show} title="Разделы" onClose={onClose}>
      {activeWorkspace && showWorkspaceSwitcher ? (
        <label className="ds-menu-workspace-switcher">
          <span>Список</span>
          <select
            aria-label="Активный список"
            value={activeWorkspace.id}
            onChange={(event) => void onSelectWorkspace(event.target.value)}
          >
            {workspaces.map((workspace) => (
              <option key={workspace.id} value={workspace.id}>
                {workspace.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <div className="ds-bottom-sheet__actions">
        {menuTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              className={
                isActive
                  ? "ds-bottom-sheet__action ds-bottom-sheet__action--active"
                  : "ds-bottom-sheet__action"
              }
              type="button"
              onClick={() => onSelectTab(tab.id)}
            >
              <Icon aria-hidden="true" size={18} strokeWidth={2.25} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </BottomSheet>
  );
}
