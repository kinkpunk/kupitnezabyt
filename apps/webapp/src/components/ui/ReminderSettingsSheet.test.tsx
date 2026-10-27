import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import { ReminderSettingsSheet } from "./ReminderSettingsSheet";

const entity = {
  id: "item-1",
  entityType: "ITEM" as const,
  name: "Кофе",
  usageCycleDays: 14,
  reminderEnabled: true
};

function renderSheet(overrides: Partial<React.ComponentProps<typeof ReminderSettingsSheet>> = {}) {
  return render(
    <ReminderSettingsSheet
      entity={entity}
      isSaving={false}
      onClose={vi.fn()}
      onSave={vi.fn().mockResolvedValue(undefined)}
      {...overrides}
    />
  );
}

describe("ReminderSettingsSheet", () => {
  it("prefills values from the entity", () => {
    renderSheet();
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "true");
    expect(screen.getByLabelText("Количество дней")).toHaveValue(14);
  });

  it("disables the days input while the switch is off", () => {
    renderSheet({ entity: { ...entity, reminderEnabled: false } });
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "false");
    expect(screen.getByLabelText("Количество дней")).toBeDisabled();
  });

  it("saves and closes on submit", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    renderSheet({ onSave, onClose });

    fireEvent.change(screen.getByLabelText("Количество дней"), { target: { value: "30" } });
    fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith({ usageCycleDays: 30, reminderEnabled: true })
    );
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("does not save non-integer cycle days", () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderSheet({ onSave });

    fireEvent.change(screen.getByLabelText("Количество дней"), { target: { value: "2.5" } });
    fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    expect(onSave).not.toHaveBeenCalled();
  });

  it("shows an error when saving fails", async () => {
    const onSave = vi.fn().mockRejectedValue(new Error("Сеть недоступна"));
    renderSheet({ onSave });

    fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("Сеть недоступна")
    );
  });

  it("saves an empty cycle as null", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderSheet({ onSave });

    fireEvent.change(screen.getByLabelText("Количество дней"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith({ usageCycleDays: null, reminderEnabled: true })
    );
  });

  it("enables the switch with a default 30-day cycle when no cycle was set", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderSheet({
      entity: { ...entity, usageCycleDays: null, reminderEnabled: false },
      onSave
    });

    const daysInput = screen.getByLabelText("Количество дней");
    expect(daysInput).toBeDisabled();

    fireEvent.click(screen.getByRole("switch"));

    expect(daysInput).toBeEnabled();
    expect(daysInput).toHaveValue(30);

    fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith({ usageCycleDays: 30, reminderEnabled: true })
    );
  });

  it("shows saving state on the submit button", () => {
    renderSheet({ isSaving: true });
    expect(screen.getByRole("button", { name: "Сохраняем..." })).toBeDisabled();
    expect(screen.getByRole("switch")).toBeDisabled();
  });
});
