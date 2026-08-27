"use client";

import { Mail } from "lucide-react";

import { ErrorNotice } from "../ui/ErrorNotice";
import { BrandWord } from "../ui/BrandWord";
import { Button } from "../ui/Button";

export function LoginScreen({
  error,
  onCloseError,
  authProviders,
  isStartingGoogleSignIn,
  isStartingAppleSignIn,
  isRequestingMagicLink,
  email,
  onEmailChange,
  emailAuthMessage,
  devMagicLink,
  onStartGoogleSignIn,
  onStartAppleSignIn,
  onRequestMagicLink
}: {
  error: string | null;
  onCloseError: () => void;
  authProviders: { google: boolean; apple: boolean } | null;
  isStartingGoogleSignIn: boolean;
  isStartingAppleSignIn: boolean;
  isRequestingMagicLink: boolean;
  email: string;
  onEmailChange: (value: string) => void;
  emailAuthMessage: string | null;
  devMagicLink: string | null;
  onStartGoogleSignIn: () => Promise<void>;
  onStartAppleSignIn: () => Promise<void>;
  onRequestMagicLink: () => Promise<void>;
}) {
  const isBusy = isStartingGoogleSignIn || isStartingAppleSignIn || isRequestingMagicLink;

  return (
    <main className="app-shell ds-onboarding-shell">
      <ErrorNotice message={error} onClose={onCloseError} />
      <section className="ds-onboarding-panel">
        <div className="ds-login-heading">
          <div className="brand-lockup brand-lockup-large">
            <img alt="" className="brand-logo" src="/logo.png" />
            <div>
              <p className="eyebrow">Вход</p>
              <h1>
                <BrandWord />
              </h1>
            </div>
          </div>
          <p>Войдите один раз, чтобы ваши товары, проверки и покупки были под рукой.</p>
        </div>
        {authProviders?.google !== false && (
          <Button
            className="ds-provider-button"
            variant="ghost"
            type="button"
            disabled={isBusy}
            onClick={() => void onStartGoogleSignIn()}
          >
            <span aria-hidden="true" className="ds-provider-button__icon">
              G
            </span>
            {isStartingGoogleSignIn ? "Открываем Google..." : "Войти через Google"}
          </Button>
        )}
        {authProviders?.apple !== false && (
          <Button
            className="ds-provider-button"
            variant="ghost"
            type="button"
            disabled={isBusy}
            onClick={() => void onStartAppleSignIn()}
          >
            <span aria-hidden="true" className="ds-provider-button__icon">
              
            </span>
            {isStartingAppleSignIn ? "Открываем Apple..." : "Войти через Apple"}
          </Button>
        )}
        <div className="ds-auth-divider">
          <span />
          <p className="eyebrow">или email</p>
          <span />
        </div>
        <div className="ds-email-auth-box">
          <input
            aria-label="Email"
            autoComplete="email"
            disabled={isBusy}
            inputMode="email"
            placeholder="you@example.com"
            type="email"
            value={email}
            onChange={(event) => onEmailChange(event.target.value)}
          />
          <Button
            className="ds-provider-button"
            variant="ghost"
            type="button"
            disabled={isBusy || !email.trim()}
            onClick={() => void onRequestMagicLink()}
          >
            <Mail aria-hidden="true" size={18} />
            {isRequestingMagicLink ? "Отправляем..." : "Получить ссылку"}
          </Button>
        </div>
        {emailAuthMessage ? <p className="ds-auth-success">{emailAuthMessage}</p> : null}
        {devMagicLink ? (
          <a className="ds-dev-magic-link" href={devMagicLink}>
            Открыть dev magic link
          </a>
        ) : null}
      </section>
    </main>
  );
}
