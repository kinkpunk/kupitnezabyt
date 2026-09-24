import { prisma } from "@kupitnezabyt/database";
import type { LegalConsent } from "@kupitnezabyt/shared";

import type { TelegramUser } from "../auth.js";
import { buildConsentCreateData, buildConsentUpdateData, userConsentSelect } from "./legal.js";

export async function upsertTelegramUser(
  telegramUser: TelegramUser,
  consent: LegalConsent | null = null
) {
  const telegramUserId = String(telegramUser.id);
  const existing = await prisma.user.findUnique({
    where: {
      telegramUserId
    },
    select: userConsentSelect
  });

  return prisma.user.upsert({
    where: {
      telegramUserId
    },
    update: {
      telegramUsername: telegramUser.username ?? null,
      firstName: telegramUser.first_name ?? null,
      language: telegramUser.language_code ?? "ru",
      ...buildConsentUpdateData(existing, consent)
    },
    create: {
      telegramUserId,
      telegramUsername: telegramUser.username ?? null,
      firstName: telegramUser.first_name ?? null,
      language: telegramUser.language_code ?? "ru",
      timezone: "Europe/Minsk",
      ...buildConsentCreateData(consent)
    }
  });
}
