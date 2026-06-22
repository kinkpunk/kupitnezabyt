import type { AuthProvider, Prisma } from "@kupitnezabyt/database";

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
  now = new Date()
): Promise<{
  id: string;
  email: string | null;
  displayName: string | null;
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

    return tx.user.update({
      where: {
        id: existingAccount.userId
      },
      data: buildUserUpdateFromVerifiedIdentity(identity, normalizedEmail, now),
      select: {
        id: true,
        email: true,
        displayName: true
      }
    });
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
            displayName: true
          }
        })
      : null;

  if (matchedUser) {
    const user = await tx.user.update({
      where: {
        id: matchedUser.id
      },
      data: buildUserUpdateFromVerifiedIdentity(identity, normalizedEmail, now),
      select: {
        id: true,
        email: true,
        displayName: true
      }
    });

    await createAuthAccount(tx, user.id, identity, normalizedEmail);
    return user;
  }

  const user = await tx.user.create({
    data: {
      email: identity.emailVerified ? normalizedEmail : null,
      emailVerifiedAt: identity.emailVerified && normalizedEmail ? now : null,
      displayName: identity.displayName,
      language: "ru",
      timezone: "Europe/Minsk"
    },
    select: {
      id: true,
      email: true,
      displayName: true
    }
  });

  await createAuthAccount(tx, user.id, identity, normalizedEmail);
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
