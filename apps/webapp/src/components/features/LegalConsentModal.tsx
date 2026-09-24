"use client";

import React, { useState } from "react";
import { PRIVACY_VERSION, TERMS_VERSION, type LegalConsent } from "@kupitnezabyt/shared";

import { BrandWord } from "../ui/BrandWord";
import { Button } from "../ui/Button";
import { LegalConsentCheckboxes } from "./LoginScreen";

export function LegalConsentModal({
  isSaving,
  onAccept
}: {
  isSaving: boolean;
  onAccept: (consent: LegalConsent) => Promise<void>;
}) {
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const consentReady = termsAccepted && privacyAccepted;

  return (
    <main className="app-shell ds-onboarding-shell">
      <section className="ds-onboarding-panel">
        <div className="ds-login-heading">
          <div className="brand-lockup brand-lockup-large">
            <img alt="" className="brand-logo" src="/logo.png" />
            <div>
              <p className="eyebrow">Обновление условий</p>
              <h1>
                <BrandWord />
              </h1>
            </div>
          </div>
          <p>
            Чтобы продолжить пользоваться сервисом, примите актуальные Условия использования и
            Политику конфиденциальности. Факт акцепта с датой и версиями документов мы фиксируем в
            аккаунте.
          </p>
        </div>
        <LegalConsentCheckboxes
          show
          termsAccepted={termsAccepted}
          privacyAccepted={privacyAccepted}
          onTermsAcceptedChange={setTermsAccepted}
          onPrivacyAcceptedChange={setPrivacyAccepted}
        />
        <Button
          className="ds-provider-button"
          type="button"
          disabled={!consentReady || isSaving}
          onClick={() =>
            void onAccept({
              termsVersion: TERMS_VERSION,
              privacyVersion: PRIVACY_VERSION,
              acceptedAt: new Date().toISOString()
            })
          }
        >
          {isSaving ? "Сохраняем..." : "Принять и продолжить"}
        </Button>
      </section>
    </main>
  );
}
