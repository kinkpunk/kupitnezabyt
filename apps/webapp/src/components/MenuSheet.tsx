"use client";

import React from "react";
import { Activity, Archive, Settings } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { BottomSheet } from "./common";
import type { ActiveTab } from "../hooks/useAppState";
import type { WorkspaceSummary } from "../lib/types";

const menuItems: { id: ActiveTab | "activity"; icon: LucideIcon; label: string }[] = [
  { id: "settings", icon: Settings, label: "Настройки" },
  { id: "activity", icon: Activity, label: "Активность" },
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
  onOpenActivity,
  onSelectWorkspace
}: {
  show: boolean;
  activeWorkspace: WorkspaceSummary | null;
  workspaces: WorkspaceSummary[];
  showWorkspaceSwitcher: boolean;
  activeTab: ActiveTab;
  onClose: () => void;
  onSelectTab: (tab: ActiveTab) => void;
  onOpenActivity: () => void;
  onSelectWorkspace: (workspaceId: string) => Promise<void>;
}) {
  return (
    <BottomSheet show={show} title="Меню" id="menu-sheet" onClose={onClose}>
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
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.id !== "activity" && activeTab === item.id;

          return (
            <button
              key={item.id}
              className={
                isActive
                  ? "ds-bottom-sheet__action ds-bottom-sheet__action--active"
                  : "ds-bottom-sheet__action"
              }
              type="button"
              onClick={() =>
                item.id === "activity" ? onOpenActivity() : onSelectTab(item.id)
              }
            >
              <Icon aria-hidden="true" size={18} strokeWidth={2.25} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </BottomSheet>
  );
}
