"use client";

import React, { useState } from "react";
import { Save } from "lucide-react";

import { formatError } from "../../lib/format";
import { BottomSheet } from "../common";
import { Button } from "./Button";
import { ReminderFields, type ReminderFieldsValue } from "./ReminderFields";

export type ReminderSettingEntity = {
  id: string;
  entityType: "CATEGORY" | "ITEM";
  name: string;
  usageCycleDays: number | null;
  reminderEnabled: boolean;
};

export type ReminderSettingInput = {
  usageCycleDays: number | null;
  reminderEnabled: boolean;
};

export function ReminderSettingsSheet({
  entity,
  isSaving,
  onClose,
  onSave
}: {
  entity: ReminderSettingEntity | null;
  isSaving: boolean;
  onClose: () => void;
  onSave: (input: ReminderSettingInput) => Promise<void>;
}) {
  return (
    <BottomSheet show={entity !== null} title={entity?.name ?? ""} onClose={onClose}>
      {entity ? (
        <ReminderSettingsForm
          key={entity.id}
          entity={entity}
          isSaving={isSaving}
          onClose={onClose}
          onSave={onSave}
        />
      ) : null}
    </BottomSheet>
  );
}

function ReminderSettingsForm({
  entity,
  isSaving,
  onClose,
  onSave
}: {
  entity: ReminderSettingEntity;
  isSaving: boolean;
  onClose: () => void;
  onSave: (input: ReminderSettingInput) => Promise<void>;
}) {
  const [value, setValue] = useState<ReminderFieldsValue>({
    usageCycleDays: entity.usageCycleDays,
    reminderEnabled: entity.reminderEnabled
  });
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const { usageCycleDays, reminderEnabled } = value;
    if (
      usageCycleDays !== null &&
      (!Number.isInteger(usageCycleDays) || usageCycleDays <= 0)
    ) {
      setError("Цикл проверки должен быть целым числом дней.");
      return;
    }

    setError(null);
    void onSave({ usageCycleDays, reminderEnabled })
      .then(onClose)
      .catch((caughtError) => setError(formatError(caughtError)));
  }

  return (
    <form className="ds-reminder-sheet" onSubmit={handleSubmit}>
      <ReminderFields
        idPrefix="reminder-sheet"
        disabled={isSaving}
        value={value}
        onChange={setValue}
      />
      {error ? (
        <p className="ds-inline-message ds-inline-message--error" role="alert">
          {error}
        </p>
      ) : null}
      <Button disabled={isSaving} type="submit" variant="accent">
        <Save aria-hidden="true" size={16} />
        {isSaving ? "Сохраняем..." : "Сохранить"}
      </Button>
    </form>
  );
}
