"use client";

import { Archive, Boxes, Settings, ShoppingCart, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";

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
  if (!show) {
    return null;
  }

  return (
    <div className="menu-sheet-overlay" onClick={onClose}>
      <section
        aria-label="Дополнительные разделы"
        className="menu-sheet"
        id="menu-sheet"
        role="dialog"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="menu-sheet-header">
          <strong>Разделы</strong>
          <button
            aria-label="Закрыть меню"
            className="ghost-button"
            type="button"
            onClick={onClose}
          >
            <X aria-hidden="true" size={18} />
          </button>
        </div>
        {activeWorkspace && showWorkspaceSwitcher ? (
          <label className="workspace-switcher">
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
        {menuTabs.map((tab) => {
          const Icon = tab.icon;

          return (
            <button
              className={activeTab === tab.id ? "menu-item active" : "menu-item"}
              key={tab.id}
              type="button"
              onClick={() => onSelectTab(tab.id)}
            >
              <Icon aria-hidden="true" size={18} strokeWidth={2.25} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </section>
    </div>
  );
}
