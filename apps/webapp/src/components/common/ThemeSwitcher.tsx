"use client";

import React from "react";

import type { ThemeMode } from "../../lib/ui";

export interface ThemeSwitcherProps {
  theme: ThemeMode;
  onChange: (theme: ThemeMode) => void;
}

const options: { value: ThemeMode; label: string }[] = [
  { value: "system", label: "Как на устройстве" },
  { value: "light", label: "Светлая" },
  { value: "dark", label: "Тёмная" }
];

export function ThemeSwitcher({ theme, onChange }: ThemeSwitcherProps) {
  return (
    <div className="ds-theme-switcher" role="group" aria-label="Тема оформления">
      {options.map((option) => {
        const isActive = theme === option.value;

        return (
          <button
            key={option.value}
            aria-pressed={isActive}
            className={
              isActive
                ? "ds-theme-switcher__option ds-theme-switcher__option--active"
                : "ds-theme-switcher__option"
            }
            type="button"
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
