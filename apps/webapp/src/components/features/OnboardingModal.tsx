"use client";

import React from "react";
import { ErrorNotice } from "../ui/ErrorNotice";
import { BrandWord } from "../ui/BrandWord";
import { Button } from "../ui/Button";

export function OnboardingModal({
  error,
  onCloseError,
  onboardingStep,
  setOnboardingStep,
  selectedStarterCategories,
  setSelectedStarterCategories,
  starterItems,
  setStarterItems,
  starterCategories,
  starterItemHints,
  starterCategoryOptions,
  onFinish
}: {
  error: string | null;
  onCloseError: () => void;
  onboardingStep: number;
  setOnboardingStep: (step: number) => void;
  selectedStarterCategories: string[];
  setSelectedStarterCategories: (value: string[] | ((current: string[]) => string[])) => void;
  starterItems: { name: string; categoryName: string }[];
  setStarterItems: (value: { name: string; categoryName: string }[] | ((current: { name: string; categoryName: string }[]) => { name: string; categoryName: string }[])) => void;
  starterCategories: string[];
  starterItemHints: string[];
  starterCategoryOptions: string[];
  onFinish: (skipSetup?: boolean) => Promise<void>;
}) {
  return (
    <main className="app-shell ds-onboarding-shell">
      <ErrorNotice message={error} onClose={onCloseError} />
      <section className="ds-onboarding-panel">
        <p className="eyebrow">Шаг {onboardingStep + 1} из 4</p>

        {onboardingStep === 0 ? (
          <>
            <div className="brand-lockup brand-lockup-large">
              <img alt="" className="brand-logo" src="/logo.png" />
              <h1>
                <BrandWord />
              </h1>
            </div>
            <p>
              Помогает помнить о товарах, которые регулярно заканчиваются:
              еда, аптека, косметика, дом и другое.
            </p>
            <Button type="button" onClick={() => setOnboardingStep(1)}>
              Начать
            </Button>
          </>
        ) : onboardingStep === 1 ? (
          <>
            <h1>Стартовые категории</h1>
            <p>Выберите несколько областей, с которых удобно начать.</p>
            <div className="ds-choice-grid">
              {starterCategories.map((name) => {
                const isSelected = selectedStarterCategories.includes(name);
                return (
                  <button
                    className={isSelected ? "ds-choice ds-choice--active" : "ds-choice"}
                    key={name}
                    type="button"
                    onClick={() =>
                      setSelectedStarterCategories((current) =>
                        isSelected
                          ? current.filter((categoryName) => categoryName !== name)
                          : [...current, name]
                      )
                    }
                  >
                    {name}
                  </button>
                );
              })}
            </div>
            <div className="ds-onboarding-actions">
              <Button type="button" onClick={() => setOnboardingStep(2)}>
                Продолжить
              </Button>
              <Button
                variant="ghost"
                type="button"
                onClick={() => {
                  setSelectedStarterCategories([]);
                  setOnboardingStep(2);
                }}
              >
                Пропустить
              </Button>
            </div>
          </>
        ) : onboardingStep === 2 ? (
          <>
            <h1>Первые товары</h1>
            <p>Добавьте 3-5 вещей и выберите категорию для каждой.</p>
            <div className="ds-starter-items">
              {starterItems.map((value, index) => (
                <div className="ds-starter-item-row" key={index}>
                  <input
                    aria-label={`Стартовый товар ${index + 1}`}
                    placeholder={starterItemHints[index] ?? "Товар"}
                    value={value.name}
                    onChange={(event) =>
                      setStarterItems((current) =>
                        current.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, name: event.target.value } : item
                        )
                      )
                    }
                  />
                  <select
                    aria-label={`Категория для товара ${index + 1}`}
                    value={
                      starterCategoryOptions.includes(value.categoryName)
                        ? value.categoryName
                        : starterCategoryOptions[0]
                    }
                    onChange={(event) =>
                      setStarterItems((current) =>
                        current.map((item, itemIndex) =>
                          itemIndex === index
                            ? { ...item, categoryName: event.target.value }
                            : item
                        )
                      )
                    }
                  >
                    {starterCategoryOptions.map((categoryName) => (
                      <option key={categoryName} value={categoryName}>
                        {categoryName}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            <div className="ds-onboarding-actions">
              <Button type="button" onClick={() => setOnboardingStep(3)}>
                Продолжить
              </Button>
              <Button
                variant="ghost"
                type="button"
                onClick={() => {
                  setStarterItems([]);
                  setOnboardingStep(3);
                }}
              >
                Пропустить
              </Button>
            </div>
          </>
        ) : (
          <>
            <h1>Напоминания</h1>
            <p>
              Я буду показывать напоминания внутри приложения, когда пора
              проверить запасы.
            </p>
            <div className="ds-onboarding-actions">
              <Button type="button" onClick={() => void onFinish()}>
                Готово
              </Button>
              <Button
                variant="ghost"
                type="button"
                onClick={() => void onFinish(true)}
              >
                Пропустить напоминания
              </Button>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
