import type { BrowserContext } from "@playwright/test";

// Mirrors the consent gate introduced with the legal documents flow:
// seeding both keys lets sign-in proceed without showing the consent UI.
// Versions must match packages/shared/src/legal.ts.
const e2eLegalConsent = {
  termsVersion: "1.0.0",
  privacyVersion: "1.0.0",
  acceptedAt: "2026-01-01T00:00:00.000Z"
};

export async function seedLegalConsent(context: BrowserContext): Promise<void> {
  await context.addInitScript((consent) => {
    const serialized = JSON.stringify(consent);
    window.localStorage.setItem("kupitnezabyt.legalConsent", serialized);
    window.localStorage.setItem("kupitnezabyt.pendingConsent", serialized);
  }, e2eLegalConsent);
}
