"use client";

import { ErrorNotice } from "../ui/ErrorNotice";
import { BrandWord } from "../ui/BrandWord";

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
    <main className="app-shell onboarding-shell">
      <ErrorNotice message={error} onClose={onCloseError} />
      <section className="onboarding-panel">
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
            <button type="button" onClick={() => setOnboardingStep(1)}>
              Начать
            </button>
          </>
        ) : onboardingStep === 1 ? (
          <>
            <h1>Стартовые категории</h1>
            <p>Выберите несколько областей, с которых удобно начать.</p>
            <div className="choice-grid">
              {starterCategories.map((name) => {
                const isSelected = selectedStarterCategories.includes(name);
                return (
                  <button
                    className={isSelected ? "choice active" : "choice"}
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
            <div className="onboarding-actions">
              <button type="button" onClick={() => setOnboardingStep(2)}>
                Продолжить
              </button>
              <button
                className="ghost-button"
                type="button"
                onClick={() => {
                  setSelectedStarterCategories([]);
                  setOnboardingStep(2);
                }}
              >
                Пропустить
              </button>
            </div>
          </>
        ) : onboardingStep === 2 ? (
          <>
            <h1>Первые товары</h1>
            <p>Добавьте 3-5 вещей и выберите категорию для каждой.</p>
            <div className="starter-items">
              {starterItems.map((value, index) => (
                <div className="starter-item-row" key={index}>
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
            <div className="onboarding-actions">
              <button type="button" onClick={() => setOnboardingStep(3)}>
                Продолжить
              </button>
              <button
                className="ghost-button"
                type="button"
                onClick={() => {
                  setStarterItems([]);
                  setOnboardingStep(3);
                }}
              >
                Пропустить
              </button>
            </div>
          </>
        ) : (
          <>
            <h1>Напоминания</h1>
            <p>
              Я буду показывать напоминания внутри приложения, когда пора
              проверить запасы.
            </p>
            <div className="onboarding-actions">
              <button type="button" onClick={() => void onFinish()}>
                Готово
              </button>
              <button
                className="ghost-button"
                type="button"
                onClick={() => void onFinish(true)}
              >
                Пропустить напоминания
              </button>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
