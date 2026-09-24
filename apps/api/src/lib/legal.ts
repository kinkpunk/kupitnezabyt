import type { Prisma } from "@kupitnezabyt/database";
import { isLegalConsent } from "@kupitnezabyt/shared";
import type { LegalConsent } from "@kupitnezabyt/shared";

export type UserConsentColumns = {
  termsAcceptedAt: Date | null;
  termsAcceptedVersion: string | null;
  privacyAcceptedAt: Date | null;
  privacyAcceptedVersion: string | null;
};

export const userConsentSelect = {
  termsAcceptedAt: true,
  termsAcceptedVersion: true,
  privacyAcceptedAt: true,
  privacyAcceptedVersion: true
} satisfies Prisma.UserSelect;

export function readLegalConsent(value: unknown): LegalConsent | null {
  return isLegalConsent(value) ? value : null;
}

export function hasRecordedConsent(
  user: Pick<UserConsentColumns, "termsAcceptedAt" | "privacyAcceptedAt"> | null | undefined
): boolean {
  return Boolean(user?.termsAcceptedAt && user?.privacyAcceptedAt);
}

export function buildConsentCreateData(consent: LegalConsent | null): Prisma.UserCreateInput {
  if (!consent) {
    return {};
  }

  const acceptedAt = new Date(consent.acceptedAt);
  return {
    termsAcceptedAt: acceptedAt,
    termsAcceptedVersion: consent.termsVersion,
    privacyAcceptedAt: acceptedAt,
    privacyAcceptedVersion: consent.privacyVersion
  };
}

export function buildConsentUpdateData(
  existing: UserConsentColumns | null | undefined,
  consent: LegalConsent | null
): Prisma.UserUpdateInput {
  if (!consent) {
    return {};
  }

  const acceptedAt = new Date(consent.acceptedAt);
  const data: Prisma.UserUpdateInput = {};

  if (!existing?.termsAcceptedAt || existing.termsAcceptedVersion !== consent.termsVersion) {
    data.termsAcceptedAt = acceptedAt;
    data.termsAcceptedVersion = consent.termsVersion;
  }

  if (!existing?.privacyAcceptedAt || existing.privacyAcceptedVersion !== consent.privacyVersion) {
    data.privacyAcceptedAt = acceptedAt;
    data.privacyAcceptedVersion = consent.privacyVersion;
  }

  return data;
}
