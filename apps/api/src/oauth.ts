import { ensurePersonalWorkspace } from "@kupitnezabyt/database";
import type { AuthProvider, Prisma } from "@kupitnezabyt/database";
import type { LegalConsent } from "@kupitnezabyt/shared";

import { buildConsentCreateData, buildConsentUpdateData, userConsentSelect } from "./lib/legal.js";

export type OAuthProviderIdentity = {
  provider: AuthProvider;
  providerAccountId: string;
  email: string | null;
  emailVerified: boolean;
  displayName: string | null;
};

export async function resolveOAuthUser(
  tx: Prisma.TransactionClient,
  identity: OAuthProviderIdentity,
  now = new Date(),
  consent: LegalConsent | null = null
): Promise<{
  id: string;
  email: string | null;
  displayName: string | null;
  termsAcceptedAt: Date | null;
  privacyAcceptedAt: Date | null;
}> {
  const normalizedEmail = identity.email?.trim().toLowerCase() || null;
  const existingAccount = await tx.authAccount.findUnique({
    where: {
      provider_providerAccountId: {
        provider: identity.provider,
        providerAccountId: identity.providerAccountId
      }
    }
  });

  if (existingAccount) {
    await tx.authAccount.update({
      where: {
        id: existingAccount.id
      },
      data: {
        email: normalizedEmail,
        emailVerified: identity.emailVerified,
        displayName: identity.displayName
      }
    });

    const existingUser = await tx.user.findUnique({
      where: {
        id: existingAccount.userId
      },
      select: userConsentSelect
    });

    const user = await tx.user.update({
      where: {
        id: existingAccount.userId
      },
      data: {
        ...buildUserUpdateFromVerifiedIdentity(identity, normalizedEmail, now),
        ...buildConsentUpdateData(existingUser, consent)
      },
      select: {
        id: true,
        email: true,
        displayName: true,
        termsAcceptedAt: true,
        privacyAcceptedAt: true
      }
    });

    await ensurePersonalWorkspace(tx, {
      userId: user.id,
      name: user.displayName ?? user.email,
      now
    });
    return user;
  }

  const matchedUser =
    normalizedEmail && identity.emailVerified
      ? await tx.user.findUnique({
          where: {
            email: normalizedEmail
          },
          select: {
            id: true,
            email: true,
            displayName: true,
            ...userConsentSelect
          }
        })
      : null;

  if (matchedUser) {
    const user = await tx.user.update({
      where: {
        id: matchedUser.id
      },
      data: {
        ...buildUserUpdateFromVerifiedIdentity(identity, normalizedEmail, now),
        ...buildConsentUpdateData(matchedUser, consent)
      },
      select: {
        id: true,
        email: true,
        displayName: true,
        termsAcceptedAt: true,
        privacyAcceptedAt: true
      }
    });

    await createAuthAccount(tx, user.id, identity, normalizedEmail);
    await ensurePersonalWorkspace(tx, {
      userId: user.id,
      name: user.displayName ?? user.email,
      now
    });
    return user;
  }

  const user = await tx.user.create({
    data: {
      email: identity.emailVerified ? normalizedEmail : null,
      emailVerifiedAt: identity.emailVerified && normalizedEmail ? now : null,
      displayName: identity.displayName,
      language: "ru",
      timezone: "Europe/Minsk",
      ...buildConsentCreateData(consent)
    },
    select: {
      id: true,
      email: true,
      displayName: true,
      termsAcceptedAt: true,
      privacyAcceptedAt: true
    }
  });

  await createAuthAccount(tx, user.id, identity, normalizedEmail);
  await ensurePersonalWorkspace(tx, {
    userId: user.id,
    name: user.displayName ?? user.email,
    now
  });
  return user;
}

function buildUserUpdateFromVerifiedIdentity(
  identity: OAuthProviderIdentity,
  normalizedEmail: string | null,
  now: Date
): Prisma.UserUpdateInput {
  const data: Prisma.UserUpdateInput = {};

  if (identity.emailVerified && normalizedEmail) {
    data.email = normalizedEmail;
    data.emailVerifiedAt = now;
  }

  if (identity.displayName) {
    data.displayName = identity.displayName;
  }

  return data;
}

function createAuthAccount(
  tx: Prisma.TransactionClient,
  userId: string,
  identity: OAuthProviderIdentity,
  normalizedEmail: string | null
) {
  return tx.authAccount.create({
    data: {
      userId,
      provider: identity.provider,
      providerAccountId: identity.providerAccountId,
      email: normalizedEmail,
      emailVerified: identity.emailVerified,
      displayName: identity.displayName
    }
  });
}
