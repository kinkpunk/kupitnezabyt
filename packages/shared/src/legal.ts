export const TERMS_VERSION = "1.0.0";
export const PRIVACY_VERSION = "1.0.0";
export const LEGAL_DOCUMENTS_UPDATED_AT = "2026-09-23";

export type LegalConsent = {
  termsVersion: string;
  privacyVersion: string;
  acceptedAt: string;
};

export function isLegalConsent(value: unknown): value is LegalConsent {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate.termsVersion !== "string" ||
    !candidate.termsVersion.trim() ||
    typeof candidate.privacyVersion !== "string" ||
    !candidate.privacyVersion.trim() ||
    typeof candidate.acceptedAt !== "string"
  ) {
    return false;
  }

  return !Number.isNaN(new Date(candidate.acceptedAt).getTime());
}
