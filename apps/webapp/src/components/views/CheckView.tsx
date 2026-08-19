"use client";

import type { ItemStatus } from "@kupitnezabyt/shared";

import { formatError } from "../../lib/format";
import type { Category, CheckSession, CheckSessionItem } from "../../lib/types";
import { statusLabels, statusOptions } from "../../lib/ui";

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
  return (
    <section className="stack">
      <div className="section-heading">
        <div>
          <h2>Проверка</h2>
          <p>
            {checkSession
              ? `${checkedCount} из ${checkSession.items.length}`
              : "Выберите категорию"}
          </p>
        </div>
        {checkSession?.status === "IN_PROGRESS" ? (
          <button
            className="ghost-button"
            type="button"
            onClick={() =>
              void onCancelCheck().catch((caughtError) => setError(formatError(caughtError)))
            }
          >
            Отмена
          </button>
        ) : null}
      </div>

      {checkSession?.status !== "IN_PROGRESS" ? (
        <form
          className="inline-form"
          onSubmit={(event) => {
            event.preventDefault();
            void onStartCategoryCheck().catch((caughtError) =>
              setError(formatError(caughtError))
            );
          }}
        >
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
          <button type="submit" disabled={!selectedCategory || selectedCategory.itemCount === 0}>
            Начать
          </button>
        </form>
      ) : null}

      {checkSession?.status === "COMPLETED" ? (
        <p className="empty">
          {pendingCheckItemName
            ? `Завершаем проверку, сохраняем "${pendingCheckItemName}"...`
            : "Проверка завершена."}
        </p>
      ) : checkSession?.status === "CANCELLED" ? (
        <p className="empty">Проверка отменена.</p>
      ) : currentCheckItem ? (
        <article className="check-card">
          <p className="eyebrow">
            {checkSession?.category?.name ?? checkSession?.group?.name ?? "Проверка"}
          </p>
          <h2>{currentCheckItem.item.name}</h2>
          {pendingCheckItemName ? (
            <p className="check-saving" role="status">
              Сохраняем "{pendingCheckItemName}"...
            </p>
          ) : null}
          <div className="status-grid">
            {statusOptions.map((status) => (
              <button
                disabled={Boolean(pendingCheckItemName)}
                key={status}
                type="button"
                onClick={() =>
                  void onCheckStatus(status).catch((caughtError) =>
                    setError(formatError(caughtError))
                  )
                }
              >
                {statusLabels[status]}
              </button>
            ))}
          </div>
        </article>
      ) : (
        <p className="empty">
          {pendingCheckItemName
            ? `Сохраняем "${pendingCheckItemName}"...`
            : "Выберите категорию и начните пошаговую проверку."}
        </p>
      )}
    </section>
  );
}
