import { prisma } from "@kupitnezabyt/database";
import type { Prisma } from "@kupitnezabyt/database";
import {
  getRuleBasedRecommendations,
  HIDE_SIMILAR_RECOMMENDATION_ITEM,
  normalizeName
} from "@kupitnezabyt/shared";

export async function getRecommendationsForItem(
  userId: string,
  workspaceId: string,
  triggerItem: {
    id: string;
    name: string;
    createdAt?: Date | null;
    lastBoughtAt?: Date | null;
  }
) {
  const [activeItems, dismissals] = await Promise.all([
    prisma.item.findMany({
      where: {
        workspaceId,
        archivedAt: null
      },
      select: {
        id: true,
        name: true
      }
    }),
    prisma.recommendationDismissal.findMany({
      where: {
        userId,
        workspaceId
      },
      select: {
        ruleId: true,
        suggestedItem: true,
        createdAt: true
      }
    })
  ]);

  return getRuleBasedRecommendations({
    triggerItem,
    userItems: activeItems,
    dismissals,
    limit: 5
  });
}

export async function clearRecommendationDismissalsForItems(
  tx: Prisma.TransactionClient,
  userId: string,
  workspaceId: string,
  triggerItems: {
    id: string;
    name: string;
    createdAt?: Date | null;
    lastBoughtAt?: Date | null;
  }[],
  activeItems: {
    id: string;
    name: string;
  }[]
): Promise<void> {
  const dismissalKeys = new Map<string, { ruleId: string; suggestedItem: string }>();

  for (const triggerItem of triggerItems) {
    const suggestions = getRuleBasedRecommendations({
      triggerItem,
      userItems: activeItems,
      dismissals: [],
      limit: 50
    });

    for (const suggestion of suggestions) {
      dismissalKeys.set(`${suggestion.ruleId}:${normalizeName(suggestion.suggestedItem)}`, {
        ruleId: suggestion.ruleId,
        suggestedItem: suggestion.suggestedItem
      });
      dismissalKeys.set(`${suggestion.ruleId}:${HIDE_SIMILAR_RECOMMENDATION_ITEM}`, {
        ruleId: suggestion.ruleId,
        suggestedItem: HIDE_SIMILAR_RECOMMENDATION_ITEM
      });
    }
  }

  const dismissalFilters = [...dismissalKeys.values()].map((dismissal) => ({
    ruleId: dismissal.ruleId,
    suggestedItem: dismissal.suggestedItem
  }));

  if (!dismissalFilters.length) {
    return;
  }

  await tx.recommendationDismissal.deleteMany({
    where: {
      userId,
      workspaceId,
      OR: dismissalFilters
    }
  });
}
