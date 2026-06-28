import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  item: {
    findFirst: vi.fn(),
    findMany: vi.fn()
  },
  recommendationDismissal: {
    findMany: vi.fn(),
    upsert: vi.fn()
  }
}));

vi.mock("@kupitnezabyt/database", () => ({
  cancelPendingItemCheckReminders: vi.fn(),
  ensurePersonalWorkspace: vi.fn(),
  getPersonalWorkspaceId: (userId: string) => `workspace_${userId}`,
  markShoppingListItemBought: vi.fn(),
  prisma: mockPrisma,
  setItemStatus: vi.fn(),
  upsertItemCheckReminder: vi.fn()
}));

describe("recommendation routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JWT_SECRET = "test-secret";
  });

  it("hides similar recommendations by storing a rule-family dismissal", async () => {
    const { buildServer } = await import("./server.js");
    const { signToken } = await import("./auth.js");
    const app = buildServer();

    mockPrisma.item.findFirst.mockResolvedValue({
      id: "item-1",
      userId: "user-1",
      name: "Кофе",
      createdAt: new Date("2026-06-20T10:00:00.000Z"),
      lastBoughtAt: null,
      archivedAt: null
    });
    mockPrisma.item.findMany.mockResolvedValue([{ id: "item-1", name: "Кофе" }]);
    mockPrisma.recommendationDismissal.findMany.mockResolvedValue([]);
    mockPrisma.recommendationDismissal.upsert.mockResolvedValue({});

    const response = await app.inject({
      method: "POST",
      url: "/api/recommendations/item-1:coffee-basics:%D0%9C%D0%BE%D0%BB%D0%BE%D0%BA%D0%BE/hide-similar",
      headers: {
        authorization: `Bearer ${createToken(signToken)}`
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      hidden: true,
      ruleId: "coffee-basics"
    });
    expect(mockPrisma.recommendationDismissal.upsert).toHaveBeenCalledWith({
      where: {
        userId_ruleId_suggestedItem: {
          userId: "user-1",
          ruleId: "coffee-basics",
          suggestedItem: "*"
        }
      },
      update: {},
      create: {
        userId: "user-1",
        workspaceId: "workspace_user-1",
        ruleId: "coffee-basics",
        suggestedItem: "*"
      }
    });

    await app.close();
  });
});

function createToken(signToken: typeof import("./auth.js").signToken): string {
  return signToken(
    "user-1",
    {
      appBaseUrl: "http://localhost:3000",
      devAuthEnabled: false,
      emailFrom: undefined,
      emailProviderApiKey: undefined,
      jwtSecret: "test-secret",
      magicLinkTokenTtlMinutes: 15,
      nodeEnv: "test",
      googleClientId: undefined,
      googleClientSecret: undefined,
      googleRedirectUri: undefined,
      appleClientId: undefined,
      appleTeamId: undefined,
      appleKeyId: undefined,
      applePrivateKey: undefined,
      appleRedirectUri: undefined,
      port: 3001,
      telegramBotToken: undefined
    }
  );
}
