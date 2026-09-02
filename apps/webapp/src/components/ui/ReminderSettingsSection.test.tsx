import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import type { ReminderDraft } from "../../hooks/useAppState";
import { ReminderSettingsSection } from "./ReminderSettingsSection";

function createProps(overrides: Partial<React.ComponentProps<typeof ReminderSettingsSection>> = {}) {
  return {
    title: "Категории",
    emptyMessage: "Создайте категорию.",
    saveLabel: "Сохранить категории",
    isSaving: false,
    rows: [
      { id: "cat-1", entityType: "CATEGORY" as const, title: "Еда", subtitle: "Дата не задана" }
    ],
    drafts: {
      "CATEGORY:cat-1": { usageCycleDays: "7", reminderEnabled: true } as ReminderDraft
    },
    onDraftChange: vi.fn(),
    onSave: vi.fn(),
    ...overrides
  };
}

describe("ReminderSettingsSection", () => {
  it("renders title and rows", () => {
    render(<ReminderSettingsSection {...createProps()} />);
    expect(screen.getByRole("heading", { name: "Категории" })).toBeInTheDocument();
    expect(screen.getByText("Еда")).toBeInTheDocument();
  });

  it("renders empty message when no rows", () => {
    render(<ReminderSettingsSection {...createProps({ rows: [] })} />);
    expect(screen.getByText("Создайте категорию.")).toBeInTheDocument();
  });

  it("calls onSave when save button is clicked", () => {
    const onSave = vi.fn();
    render(<ReminderSettingsSection {...createProps({ onSave })} />);
    fireEvent.click(screen.getByRole("button", { name: "Сохранить категории" }));
    expect(onSave).toHaveBeenCalledOnce();
  });

  it("hides save button when no rows", () => {
    render(<ReminderSettingsSection {...createProps({ rows: [] })} />);
    expect(screen.queryByRole("button", { name: "Сохранить категории" })).not.toBeInTheDocument();
  });

  it("calls onDraftChange when toggle is clicked", () => {
    const onDraftChange = vi.fn();
    render(<ReminderSettingsSection {...createProps({ onDraftChange })} />);
    fireEvent.click(screen.getByRole("checkbox", { name: "Напоминания: Еда" }));
    expect(onDraftChange).toHaveBeenCalledWith("CATEGORY:cat-1", {
      usageCycleDays: "7",
      reminderEnabled: false
    });
  });

  it("calls onDraftChange when days input changes", () => {
    const onDraftChange = vi.fn();
    render(<ReminderSettingsSection {...createProps({ onDraftChange })} />);
    fireEvent.change(screen.getByRole("spinbutton", { name: "Цикл проверки: Еда" }), {
      target: { value: "14" }
    });
    expect(onDraftChange).toHaveBeenCalledWith("CATEGORY:cat-1", {
      usageCycleDays: "14",
      reminderEnabled: true
    });
  });
});
