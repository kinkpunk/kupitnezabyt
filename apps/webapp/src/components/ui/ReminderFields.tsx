"use client";

import React from "react";

export type ReminderFieldsValue = {
  usageCycleDays: number | null;
  reminderEnabled: boolean;
};

const DEFAULT_CYCLE_DAYS = 30;

export function ReminderFields({
  disabled = false,
  idPrefix,
  onChange,
  value
}: {
  disabled?: boolean;
  idPrefix: string;
  onChange: (value: ReminderFieldsValue) => void;
  value: ReminderFieldsValue;
}) {
  const labelId = `${idPrefix}-reminder-label`;

  function handleToggle() {
    const reminderEnabled = !value.reminderEnabled;
    onChange({
      reminderEnabled,
      usageCycleDays:
        reminderEnabled && value.usageCycleDays === null ? DEFAULT_CYCLE_DAYS : value.usageCycleDays
    });
  }

  function handleDaysChange(event: React.ChangeEvent<HTMLInputElement>) {
    const raw = event.target.value;
    onChange({ ...value, usageCycleDays: raw === "" ? null : Number(raw) });
  }

  return (
    <div className="ds-reminder-fields">
      <button
        aria-checked={value.reminderEnabled}
        aria-labelledby={labelId}
        className="ds-reminder-switch"
        disabled={disabled}
        role="switch"
        type="button"
        onClick={handleToggle}
      >
        <span className="ds-reminder-switch__thumb" />
      </button>
      <span className="ds-reminder-fields__label" id={labelId}>
        Напоминать каждые
      </span>
      <input
        aria-label="Количество дней"
        className="ds-reminder-fields__days"
        disabled={disabled || !value.reminderEnabled}
        inputMode="numeric"
        min="1"
        type="number"
        value={value.usageCycleDays ?? ""}
        onChange={handleDaysChange}
      />
      <span className="ds-reminder-fields__unit">дней</span>
    </div>
  );
}
