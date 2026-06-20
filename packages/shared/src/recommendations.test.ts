import { describe, expect, it } from "vitest";

import {
  createRecommendationId,
  getRuleBasedRecommendations,
  normalizeName,
  parseRecommendationId
} from "./recommendations.js";

describe("normalizeName", () => {
  it("normalizes case, spaces, and yo letter", () => {
    expect(normalizeName("  Зелёный   ЧАЙ  ")).toBe("зеленый чай");
  });
});

describe("recommendation ids", () => {
  it("round-trips suggested item names", () => {
    const id = createRecommendationId({
      itemId: "item-1",
      ruleId: "coffee-basics",
      suggestedItem: "Овсяное молоко"
    });

    expect(parseRecommendationId(id)).toEqual({
      itemId: "item-1",
      ruleId: "coffee-basics",
      suggestedItem: "Овсяное молоко"
    });
  });

  it("rejects malformed ids", () => {
    expect(parseRecommendationId("broken")).toBeNull();
  });
});

describe("getRuleBasedRecommendations", () => {
  it("returns deterministic recommendations for a matching trigger", () => {
    const suggestions = getRuleBasedRecommendations({
      triggerItem: {
        id: "item-1",
        name: "Кофе"
      },
      userItems: [{ id: "item-1", name: "Кофе" }],
      dismissals: []
    });

    expect(suggestions.map((suggestion) => suggestion.suggestedItem)).toEqual([
      "Фильтры для кофе",
      "Молоко",
      "Овсяное молоко"
    ]);
  });

  it("suppresses duplicates and dismissed suggestions", () => {
    const suggestions = getRuleBasedRecommendations({
      triggerItem: {
        id: "item-1",
        name: "Кофе",
        createdAt: "2026-06-20T10:00:00.000Z"
      },
      userItems: [
        { id: "item-1", name: "Кофе" },
        { id: "item-2", name: "молоко" }
      ],
      dismissals: [
        {
          ruleId: "coffee-basics",
          suggestedItem: "Фильтры для кофе",
          createdAt: "2026-06-20T10:05:00.000Z"
        }
      ]
    });

    expect(suggestions.map((suggestion) => suggestion.suggestedItem)).toEqual([
      "Овсяное молоко"
    ]);
  });

  it("ignores dismissals from before the item was bought again", () => {
    const suggestions = getRuleBasedRecommendations({
      triggerItem: {
        id: "item-1",
        name: "Кофе",
        createdAt: "2026-06-20T10:00:00.000Z",
        lastBoughtAt: "2026-06-21T10:00:00.000Z"
      },
      userItems: [{ id: "item-1", name: "Кофе" }],
      dismissals: [
        {
          ruleId: "coffee-basics",
          suggestedItem: "Фильтры для кофе",
          createdAt: "2026-06-20T10:05:00.000Z"
        }
      ]
    });

    expect(suggestions.map((suggestion) => suggestion.suggestedItem)).toContain(
      "Фильтры для кофе"
    );
  });

  it("ignores dismissals from before a new matching item was added", () => {
    const suggestions = getRuleBasedRecommendations({
      triggerItem: {
        id: "item-2",
        name: "Кофе",
        createdAt: "2026-06-21T10:00:00.000Z"
      },
      userItems: [{ id: "item-2", name: "Кофе" }],
      dismissals: [
        {
          ruleId: "coffee-basics",
          suggestedItem: "Фильтры для кофе",
          createdAt: "2026-06-20T10:05:00.000Z"
        }
      ]
    });

    expect(suggestions.map((suggestion) => suggestion.suggestedItem)).toContain(
      "Фильтры для кофе"
    );
  });

  it("honors required terms", () => {
    const rules = [
      {
        id: "required-term-rule",
        triggerTerms: ["кофе"],
        requiredTerms: ["кофемашина"],
        suggestedItems: ["Средство для чистки"]
      }
    ];

    expect(
      getRuleBasedRecommendations({
        triggerItem: { id: "item-1", name: "Кофе" },
        userItems: [{ id: "item-1", name: "Кофе" }],
        dismissals: [],
        rules
      })
    ).toEqual([]);

    expect(
      getRuleBasedRecommendations({
        triggerItem: { id: "item-1", name: "Кофе" },
        userItems: [
          { id: "item-1", name: "Кофе" },
          { id: "item-2", name: "Кофемашина" }
        ],
        dismissals: [],
        rules
      }).map((suggestion) => suggestion.suggestedItem)
    ).toEqual(["Средство для чистки"]);
  });
});
