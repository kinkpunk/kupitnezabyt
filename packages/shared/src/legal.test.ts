import { describe, expect, it } from "vitest";

import { isLegalConsent, LEGAL_DOCUMENTS_UPDATED_AT, PRIVACY_VERSION, TERMS_VERSION } from "./legal.js";

describe("legal documents", () => {
  it("exposes document versions and the last update date", () => {
    expect(TERMS_VERSION).toBe("1.0.0");
    expect(PRIVACY_VERSION).toBe("1.0.0");
    expect(LEGAL_DOCUMENTS_UPDATED_AT).toBe("2026-09-23");
  });
});

describe("isLegalConsent", () => {
  it("accepts a well-formed consent payload", () => {
    expect(
      isLegalConsent({
        termsVersion: "1.0.0",
        privacyVersion: "1.0.0",
        acceptedAt: "2026-09-23T10:00:00.000Z"
      })
    ).toBe(true);
  });

  it("rejects malformed payloads", () => {
    expect(isLegalConsent(null)).toBe(false);
    expect(isLegalConsent("consent")).toBe(false);
    expect(isLegalConsent({})).toBe(false);
    expect(
      isLegalConsent({ termsVersion: "", privacyVersion: "1.0.0", acceptedAt: "2026-09-23T10:00:00.000Z" })
    ).toBe(false);
    expect(
      isLegalConsent({ termsVersion: "1.0.0", privacyVersion: "1.0.0", acceptedAt: "not-a-date" })
    ).toBe(false);
    expect(
      isLegalConsent({ termsVersion: "1.0.0", privacyVersion: 1, acceptedAt: "2026-09-23T10:00:00.000Z" })
    ).toBe(false);
  });
});
