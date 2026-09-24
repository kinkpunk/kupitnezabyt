"use client";

import React from "react";
import { Mail } from "lucide-react";

import { ErrorNotice } from "../ui/ErrorNotice";
import { BrandWord } from "../ui/BrandWord";
import { Button } from "../ui/Button";

export function openLegalDocument(path: string): void {
  window.open(path, "_blank", "noopener,noreferrer");
}

export function LegalConsentCheckboxes({
  show,
  termsAccepted,
  privacyAccepted,
  onTermsAcceptedChange,
  onPrivacyAcceptedChange
}: {
  show: boolean;
  termsAccepted: boolean;
  privacyAccepted: boolean;
  onTermsAcceptedChange: (value: boolean) => void;
  onPrivacyAcceptedChange: (value: boolean) => void;
}) {
  if (!show) {
    return null;
  }

  return (
    <div className="ds-legal-consent">
      <label className="ds-legal-consent__item">
        <input
          checked={termsAccepted}
          type="checkbox"
          onChange={(event) => onTermsAcceptedChange(event.target.checked)}
        />
        <span>
          Принимаю{" "}
          <a
            href="/terms"
            onClick={(event) => {
              event.preventDefault();
              openLegalDocument("/terms");
            }}
          >
            Условия использования
          </a>
        </span>
      </label>
      <label className="ds-legal-consent__item">
        <input
          checked={privacyAccepted}
          type="checkbox"
          onChange={(event) => onPrivacyAcceptedChange(event.target.checked)}
        />
        <span>
          Согласен с обработкой персональных данных по{" "}
          <a
            href="/privacy"
            onClick={(event) => {
              event.preventDefault();
              openLegalDocument("/privacy");
            }}
          >
            Политике конфиденциальности
          </a>
        </span>
      </label>
    </div>
  );
}

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
  showLegalConsent,
  termsAccepted,
  privacyAccepted,
  onTermsAcceptedChange,
  onPrivacyAcceptedChange,
  telegramAvailable,
  isContinuingWithTelegram,
  onContinueWithTelegram,
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
  showLegalConsent: boolean;
  termsAccepted: boolean;
  privacyAccepted: boolean;
  onTermsAcceptedChange: (value: boolean) => void;
  onPrivacyAcceptedChange: (value: boolean) => void;
  telegramAvailable: boolean;
  isContinuingWithTelegram: boolean;
  onContinueWithTelegram: () => Promise<void>;
  onStartGoogleSignIn: () => Promise<void>;
  onStartAppleSignIn: () => Promise<void>;
  onRequestMagicLink: () => Promise<void>;
}) {
  const isBusy =
    isStartingGoogleSignIn ||
    isStartingAppleSignIn ||
    isRequestingMagicLink ||
    isContinuingWithTelegram;
  const consentReady = !showLegalConsent || (termsAccepted && privacyAccepted);

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
        {telegramAvailable ? (
          <Button
            className="ds-provider-button"
            type="button"
            disabled={isBusy || !consentReady}
            onClick={() => void onContinueWithTelegram()}
          >
            {isContinuingWithTelegram ? "Открываем Telegram..." : "Продолжить через Telegram"}
          </Button>
        ) : null}
        {authProviders?.google !== false && (
          <Button
            className="ds-provider-button"
            variant="ghost"
            type="button"
            disabled={isBusy || !consentReady}
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
            disabled={isBusy || !consentReady}
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
            disabled={isBusy || !email.trim() || !consentReady}
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
        <LegalConsentCheckboxes
          show={showLegalConsent}
          termsAccepted={termsAccepted}
          privacyAccepted={privacyAccepted}
          onTermsAcceptedChange={onTermsAcceptedChange}
          onPrivacyAcceptedChange={onPrivacyAcceptedChange}
        />
      </section>
      <footer className="ds-login-footer">
        <a href="/terms">Условия использования</a>
        <a href="/privacy">Политика конфиденциальности</a>
      </footer>
    </main>
  );
}
