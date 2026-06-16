export type RecommendationRule = {
  id: string;
  triggerTerms: string[];
  requiredTerms?: string[];
  suggestedItems: string[];
  categoryHint?: string;
};

export type RecommendationSourceItem = {
  id: string;
  name: string;
};

export type RecommendationDismissalInput = {
  ruleId: string;
  suggestedItem: string;
};

export type RecommendationSuggestion = {
  id: string;
  ruleId: string;
  suggestedItem: string;
  categoryHint: string | null;
};

export type RecommendationIdParts = {
  itemId: string;
  ruleId: string;
  suggestedItem: string;
};

export const recommendationRules: RecommendationRule[] = [
  {
    id: "coffee-basics",
    triggerTerms: ["coffee", "кофе"],
    suggestedItems: ["Фильтры для кофе", "Молоко", "Овсяное молоко"],
    categoryHint: "Продукты"
  },
  {
    id: "tea-basics",
    triggerTerms: ["tea", "чай"],
    suggestedItems: ["Лимон", "Мед", "Сахар"],
    categoryHint: "Продукты"
  },
  {
    id: "hair-care",
    triggerTerms: ["shampoo", "шампунь"],
    suggestedItems: ["Кондиционер", "Маска для волос"],
    categoryHint: "Косметика"
  },
  {
    id: "laundry-care",
    triggerTerms: ["laundry detergent", "washing powder", "стиральный порошок", "гель для стирки"],
    suggestedItems: ["Кондиционер для белья", "Пятновыводитель"],
    categoryHint: "Бытовая химия"
  },
  {
    id: "medicine-box",
    triggerTerms: ["ibuprofen", "ибупрофен", "парацетамол"],
    suggestedItems: ["Пластырь", "Термометр"],
    categoryHint: "Аптека"
  }
];

export function normalizeName(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase("ru-RU")
    .replaceAll("ё", "е")
    .replace(/\s+/g, " ");
}

export function createRecommendationId(parts: RecommendationIdParts): string {
  return `${parts.itemId}:${parts.ruleId}:${encodeURIComponent(parts.suggestedItem)}`;
}

export function parseRecommendationId(value: string): RecommendationIdParts | null {
  const [itemId, ruleId, encodedSuggestion, ...rest] = value.split(":");
  if (!itemId || !ruleId || !encodedSuggestion || rest.length > 0) {
    return null;
  }

  try {
    return {
      itemId,
      ruleId,
      suggestedItem: decodeURIComponent(encodedSuggestion)
    };
  } catch {
    return null;
  }
}

export function getRuleBasedRecommendations(input: {
  triggerItem: RecommendationSourceItem;
  userItems: RecommendationSourceItem[];
  dismissals: RecommendationDismissalInput[];
  limit?: number;
  rules?: RecommendationRule[];
}): RecommendationSuggestion[] {
  const limit = input.limit ?? 5;
  if (limit <= 0) {
    return [];
  }

  const normalizedTriggerName = normalizeName(input.triggerItem.name);
  const normalizedUserItemNames = new Set(
    input.userItems.map((item) => normalizeName(item.name))
  );
  const dismissedKeys = new Set(
    input.dismissals.map(
      (dismissal) => `${dismissal.ruleId}:${normalizeName(dismissal.suggestedItem)}`
    )
  );
  const suggestions: RecommendationSuggestion[] = [];
  const emittedNames = new Set<string>();

  for (const rule of input.rules ?? recommendationRules) {
    if (!matchesRule(rule, normalizedTriggerName, normalizedUserItemNames)) {
      continue;
    }

    for (const suggestedItem of rule.suggestedItems) {
      const normalizedSuggestion = normalizeName(suggestedItem);
      if (
        normalizedUserItemNames.has(normalizedSuggestion) ||
        emittedNames.has(normalizedSuggestion) ||
        dismissedKeys.has(`${rule.id}:${normalizedSuggestion}`)
      ) {
        continue;
      }

      suggestions.push({
        id: createRecommendationId({
          itemId: input.triggerItem.id,
          ruleId: rule.id,
          suggestedItem
        }),
        ruleId: rule.id,
        suggestedItem,
        categoryHint: rule.categoryHint ?? null
      });
      emittedNames.add(normalizedSuggestion);

      if (suggestions.length >= limit) {
        return suggestions;
      }
    }
  }

  return suggestions;
}

function matchesRule(
  rule: RecommendationRule,
  normalizedTriggerName: string,
  normalizedUserItemNames: Set<string>
): boolean {
  const triggerMatches = rule.triggerTerms.some((term) =>
    normalizedTriggerName.includes(normalizeName(term))
  );
  if (!triggerMatches) {
    return false;
  }

  return (rule.requiredTerms ?? []).every((term) => {
    const normalizedTerm = normalizeName(term);
    return [...normalizedUserItemNames].some((itemName) => itemName.includes(normalizedTerm));
  });
}
