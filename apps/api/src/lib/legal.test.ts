import { describe, expect, it } from "vitest";

import {
  buildConsentCreateData,
  buildConsentUpdateData,
  hasRecordedConsent,
  readLegalConsent
} from "./legal.js";

const consent = {
  termsVersion: "1.0.0",
  privacyVersion: "1.0.0",
  acceptedAt: "2026-09-23T10:00:00.000Z"
};

describe("legal consent helpers", () => {
  it("parses a valid consent payload and rejects malformed input", () => {
    expect(readLegalConsent(consent)).toEqual(consent);
    expect(readLegalConsent({ ...consent, acceptedAt: "not-a-date" })).toBeNull();
    expect(readLegalConsent(null)).toBeNull();
    expect(readLegalConsent("consent")).toBeNull();
  });

  it("builds create data with timestamps derived from acceptedAt", () => {
    expect(buildConsentCreateData(consent)).toEqual({
      termsAcceptedAt: new Date("2026-09-23T10:00:00.000Z"),
      termsAcceptedVersion: "1.0.0",
      privacyAcceptedAt: new Date("2026-09-23T10:00:00.000Z"),
      privacyAcceptedVersion: "1.0.0"
    });
    expect(buildConsentCreateData(null)).toEqual({});
  });

  it("fills empty consent columns on update", () => {
    expect(
      buildConsentUpdateData(
        {
          termsAcceptedAt: null,
          termsAcceptedVersion: null,
          privacyAcceptedAt: null,
          privacyAcceptedVersion: null
        },
        consent
      )
    ).toEqual({
      termsAcceptedAt: new Date("2026-09-23T10:00:00.000Z"),
      termsAcceptedVersion: "1.0.0",
      privacyAcceptedAt: new Date("2026-09-23T10:00:00.000Z"),
      privacyAcceptedVersion: "1.0.0"
    });
  });

  it("does not overwrite consent when the versions already match", () => {
    const existing = {
      termsAcceptedAt: new Date("2026-09-20T10:00:00.000Z"),
      termsAcceptedVersion: "1.0.0",
      privacyAcceptedAt: new Date("2026-09-20T10:00:00.000Z"),
      privacyAcceptedVersion: "1.0.0"
    };

    expect(buildConsentUpdateData(existing, consent)).toEqual({});
  });

  it("records a renewed acceptance when the document version changes", () => {
    const existing = {
      termsAcceptedAt: new Date("2026-09-20T10:00:00.000Z"),
      termsAcceptedVersion: "1.0.0",
      privacyAcceptedAt: new Date("2026-09-20T10:00:00.000Z"),
      privacyAcceptedVersion: "1.0.0"
    };

    expect(
      buildConsentUpdateData(existing, {
        ...consent,
        termsVersion: "1.1.0"
      })
    ).toEqual({
      termsAcceptedAt: new Date("2026-09-23T10:00:00.000Z"),
      termsAcceptedVersion: "1.1.0"
    });
  });

  it("reports consent as recorded only when both documents are accepted", () => {
    expect(hasRecordedConsent({ termsAcceptedAt: new Date(), privacyAcceptedAt: new Date() })).toBe(
      true
    );
    expect(hasRecordedConsent({ termsAcceptedAt: new Date(), privacyAcceptedAt: null })).toBe(false);
    expect(hasRecordedConsent(null)).toBe(false);
  });
});
