import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import { LoginScreen } from "./LoginScreen";

function createProps(overrides: Partial<React.ComponentProps<typeof LoginScreen>> = {}) {
  return {
    error: null,
    onCloseError: vi.fn(),
    authProviders: { google: true, apple: true },
    isStartingGoogleSignIn: false,
    isStartingAppleSignIn: false,
    isRequestingMagicLink: false,
    email: "",
    onEmailChange: vi.fn(),
    emailAuthMessage: null,
    devMagicLink: null,
    onStartGoogleSignIn: vi.fn().mockResolvedValue(undefined),
    onStartAppleSignIn: vi.fn().mockResolvedValue(undefined),
    onRequestMagicLink: vi.fn().mockResolvedValue(undefined),
    ...overrides
  };
}

describe("LoginScreen", () => {
  it("renders brand and auth providers", () => {
    render(<LoginScreen {...createProps()} />);
    expect(screen.getByRole("heading", { name: "kupit nezabyt" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Войти через Google" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Войти через Apple" })).toBeInTheDocument();
  });

  it("calls onStartGoogleSignIn when google button is clicked", () => {
    const onStartGoogleSignIn = vi.fn().mockResolvedValue(undefined);
    render(<LoginScreen {...createProps({ onStartGoogleSignIn })} />);
    fireEvent.click(screen.getByRole("button", { name: "Войти через Google" }));
    expect(onStartGoogleSignIn).toHaveBeenCalledOnce();
  });

  it("calls onStartAppleSignIn when apple button is clicked", () => {
    const onStartAppleSignIn = vi.fn().mockResolvedValue(undefined);
    render(<LoginScreen {...createProps({ onStartAppleSignIn })} />);
    fireEvent.click(screen.getByRole("button", { name: "Войти через Apple" }));
    expect(onStartAppleSignIn).toHaveBeenCalledOnce();
  });

  it("calls onEmailChange when email input changes", () => {
    const onEmailChange = vi.fn();
    render(<LoginScreen {...createProps({ onEmailChange })} />);
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "test@example.com" } });
    expect(onEmailChange).toHaveBeenCalledWith("test@example.com");
  });

  it("calls onRequestMagicLink when email form is submitted", () => {
    const onRequestMagicLink = vi.fn().mockResolvedValue(undefined);
    render(<LoginScreen {...createProps({ email: "test@example.com", onRequestMagicLink })} />);
    fireEvent.click(screen.getByRole("button", { name: "Получить ссылку" }));
    expect(onRequestMagicLink).toHaveBeenCalledOnce();
  });

  it("disables all buttons while busy", () => {
    render(
      <LoginScreen
        {...createProps({
          isStartingGoogleSignIn: true,
          email: "test@example.com"
        })}
      />
    );
    expect(screen.getByRole("button", { name: "Открываем Google..." })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Войти через Apple" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Получить ссылку" })).toBeDisabled();
  });

  it("renders error notice and calls onCloseError", () => {
    const onCloseError = vi.fn();
    render(<LoginScreen {...createProps({ error: "Ошибка входа", onCloseError })} />);
    expect(screen.getByText("Ошибка входа")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Закрыть ошибку" }));
    expect(onCloseError).toHaveBeenCalledOnce();
  });

  it("renders dev magic link", () => {
    render(<LoginScreen {...createProps({ devMagicLink: "http://localhost/dev-auth" })} />);
    expect(screen.getByRole("link", { name: "Открыть dev magic link" })).toHaveAttribute(
      "href",
      "http://localhost/dev-auth"
    );
  });
});
