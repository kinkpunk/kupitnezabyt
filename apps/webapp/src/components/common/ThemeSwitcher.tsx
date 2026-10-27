"use client";

import { Moon, Sun, SunMoon } from "lucide-react";
import React from "react";

import type { ThemeMode } from "../../lib/ui";

export interface ThemeSwitcherProps {
  theme: ThemeMode;
  onChange: (theme: ThemeMode) => void;
}

const options: { value: ThemeMode; label: string; Icon: typeof Sun }[] = [
  { value: "system", label: "Как на устройстве", Icon: SunMoon },
  { value: "light", label: "Светлая", Icon: Sun },
  { value: "dark", label: "Тёмная", Icon: Moon }
];

export function ThemeSwitcher({ theme, onChange }: ThemeSwitcherProps) {
  return (
    <div className="ds-theme-switcher" role="group" aria-label="Тема оформления">
      {options.map((option) => {
        const isActive = theme === option.value;
        const { Icon } = option;

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
            <Icon aria-hidden="true" size={16} />
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
