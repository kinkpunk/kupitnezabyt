import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import { OnboardingModal } from "./OnboardingModal";

function createProps(overrides: Partial<React.ComponentProps<typeof OnboardingModal>> = {}) {
  return {
    error: null,
    onCloseError: vi.fn(),
    onboardingStep: 0,
    setOnboardingStep: vi.fn(),
    selectedStarterCategories: [] as string[],
    setSelectedStarterCategories: vi.fn(),
    starterItems: [{ name: "", categoryName: "Еда" }],
    setStarterItems: vi.fn(),
    starterCategories: ["Еда", "Аптека"],
    starterItemHints: ["Кофе"],
    starterCategoryOptions: ["Еда", "Аптека"],
    onFinish: vi.fn().mockResolvedValue(undefined),
    ...overrides
  };
}

describe("OnboardingModal", () => {
  it("renders first step and starts onboarding", () => {
    const setOnboardingStep = vi.fn();
    render(<OnboardingModal {...createProps({ setOnboardingStep })} />);
    expect(screen.getByText("Шаг 1 из 4")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Начать" }));
    expect(setOnboardingStep).toHaveBeenCalledWith(1);
  });

  it("renders category selection step", () => {
    render(<OnboardingModal {...createProps({ onboardingStep: 1 })} />);
    expect(screen.getByRole("heading", { name: "Стартовые категории" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Еда" })).toBeInTheDocument();
  });

  it("toggles starter category selection", () => {
    const setSelectedStarterCategories = vi.fn();
    render(
      <OnboardingModal
        {...createProps({ onboardingStep: 1, setSelectedStarterCategories })}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Еда" }));
    expect(setSelectedStarterCategories).toHaveBeenCalledWith(expect.any(Function));
  });

  it("skips starter categories", () => {
    const setSelectedStarterCategories = vi.fn();
    const setOnboardingStep = vi.fn();
    render(
      <OnboardingModal
        {...createProps({
          onboardingStep: 1,
          setSelectedStarterCategories,
          setOnboardingStep
        })}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Пропустить" }));
    expect(setSelectedStarterCategories).toHaveBeenCalledWith([]);
    expect(setOnboardingStep).toHaveBeenCalledWith(2);
  });

  it("renders starter items step", () => {
    render(<OnboardingModal {...createProps({ onboardingStep: 2 })} />);
    expect(screen.getByRole("heading", { name: "Первые товары" })).toBeInTheDocument();
    expect(screen.getByLabelText("Стартовый товар 1")).toBeInTheDocument();
  });

  it("updates starter item name", () => {
    const setStarterItems = vi.fn();
    render(
      <OnboardingModal {...createProps({ onboardingStep: 2, setStarterItems })} />
    );
    fireEvent.change(screen.getByLabelText("Стартовый товар 1"), {
      target: { value: "Чай" }
    });
    expect(setStarterItems).toHaveBeenCalledWith(expect.any(Function));
  });

  it("renders reminders step and finishes onboarding", () => {
    const onFinish = vi.fn().mockResolvedValue(undefined);
    render(<OnboardingModal {...createProps({ onboardingStep: 3, onFinish })} />);
    expect(screen.getByRole("heading", { name: "Напоминания" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Готово" }));
    expect(onFinish).toHaveBeenCalledWith();
  });

  it("skips reminders", () => {
    const onFinish = vi.fn().mockResolvedValue(undefined);
    render(<OnboardingModal {...createProps({ onboardingStep: 3, onFinish })} />);
    fireEvent.click(screen.getByRole("button", { name: "Пропустить напоминания" }));
    expect(onFinish).toHaveBeenCalledWith(true);
  });
});
