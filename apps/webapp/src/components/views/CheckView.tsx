"use client";

import type { ItemStatus } from "@kupitnezabyt/shared";
import { CheckCircle2, ClipboardCheck } from "lucide-react";
import React from "react";

import { formatError } from "../../lib/format";
import type { Category, CheckSession, CheckSessionItem } from "../../lib/types";
import { statusLabels } from "../../lib/ui";
import { EmptyState, SectionHeader } from "../common";
import { Button } from "../ui/Button";
import { ProgressBar } from "../ui/ProgressBar";

const statusButtonOrder: ItemStatus[] = ["IN_STOCK", "LOW", "NEED_BUY", "URGENT"];

export function CheckView({
  checkSession,
  checkedCount,
  currentCheckItem,
  pendingCheckItemName,
  selectedCategory,
  categories,
  onCancelCheck,
  onStartCategoryCheck,
  onCheckStatus,
  onClearSearchSession,
  onSelectCategory,
  setError
}: {
  checkSession: CheckSession | null;
  checkedCount: number;
  currentCheckItem: CheckSessionItem | null;
  pendingCheckItemName: string | null;
  selectedCategory: Category | null | undefined;
  categories: Category[];
  onCancelCheck: () => Promise<void>;
  onStartCategoryCheck: () => Promise<void>;
  onCheckStatus: (status: ItemStatus) => Promise<void>;
  onClearSearchSession: () => void;
  onSelectCategory: (categoryId: string) => void;
  setError: (message: string | null) => void;
}) {
  function handleCancel() {
    void onCancelCheck().catch((caughtError) => setError(formatError(caughtError)));
  }

  function handleStart(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void onStartCategoryCheck().catch((caughtError) => setError(formatError(caughtError)));
  }

  function handleStatus(status: ItemStatus) {
    void onCheckStatus(status).catch((caughtError) => setError(formatError(caughtError)));
  }

  function renderStatusButton(status: ItemStatus) {
    return (
      <Button
        key={status}
        className="ds-check-status"
        disabled={Boolean(pendingCheckItemName)}
        variant="ghost"
        onClick={() => handleStatus(status)}
      >
        {statusLabels[status]}
      </Button>
    );
  }

  return (
    <section className="stack">
      <SectionHeader
        title="Проверка"
        subtitle={checkSession ? `${checkedCount} из ${checkSession.items.length}` : "Выберите категорию"}
        actions={
          checkSession?.status === "IN_PROGRESS" ? (
            <Button size="compact" variant="ghost" onClick={handleCancel}>
              Отмена
            </Button>
          ) : null
        }
      />

      {checkSession?.status !== "IN_PROGRESS" ? (
        <form className="ds-check-form" onSubmit={handleStart}>
          <select
            aria-label="Категория для проверки"
            value={selectedCategory?.id ?? ""}
            onChange={(event) => {
              onClearSearchSession();
              onSelectCategory(event.target.value);
            }}
          >
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          <Button disabled={!selectedCategory || selectedCategory.itemCount === 0} type="submit">
            Начать
          </Button>
        </form>
      ) : null}

      {checkSession?.status === "COMPLETED" ? (
        <EmptyState
          description={
            pendingCheckItemName
              ? `Завершаем проверку, сохраняем "${pendingCheckItemName}"...`
              : "Все товары проверены"
          }
          icon={CheckCircle2}
          title="Проверка завершена"
        />
      ) : checkSession?.status === "CANCELLED" ? (
        <EmptyState description="Вы можете начать новую проверку" icon={ClipboardCheck} title="Проверка отменена" />
      ) : currentCheckItem ? (
        <div className="ds-check-card">
          <SectionHeader
            subtitle={checkSession?.category?.name ?? checkSession?.group?.name ?? "Проверка"}
            title={currentCheckItem.item.name}
          />
          <ProgressBar done={checkedCount} total={checkSession?.items.length ?? 0} />
          {pendingCheckItemName ? (
            <p className="ds-check-saving" role="status">
              Сохраняем "{pendingCheckItemName}"...
            </p>
          ) : null}
          <div className="ds-check-status-grid" role="group" aria-label="Статус товара">
            {statusButtonOrder.map((status) => renderStatusButton(status))}
          </div>
        </div>
      ) : (
        <EmptyState
          description={
            pendingCheckItemName
              ? `Сохраняем "${pendingCheckItemName}"...`
              : "Выберите категорию и начните пошаговую проверку"
          }
          icon={ClipboardCheck}
          title="Начните проверку"
        />
      )}
    </section>
  );
}
