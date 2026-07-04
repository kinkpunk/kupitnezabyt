import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  user: {
    findUniqueOrThrow: vi.fn(),
    update: vi.fn()
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

describe("me routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env.APP_BASE_URL = "http://localhost:3000";
    process.env.JWT_SECRET = "test-secret";
    process.env.NODE_ENV = "test";
  });

  it("marks onboarding completed for the authenticated user", async () => {
    const { signToken } = await import("./auth.js");
    const { buildServer } = await import("./server.js");
    const app = buildServer();
    const token = signToken("user-1", {
      appBaseUrl: "http://localhost:3000",
      emailFrom: undefined,
      emailProviderApiKey: undefined,
      jwtSecret: "test-secret",
      magicLinkTokenTtlMinutes: 15,
      nodeEnv: "test",
      devAuthEnabled: false,
      googleClientId: undefined,
      googleClientSecret: undefined,
      googleRedirectUri: undefined,
      appleClientId: undefined,
      appleTeamId: undefined,
      appleKeyId: undefined,
      applePrivateKey: undefined,
      appleRedirectUri: undefined,
      telegramBotToken: undefined,
      port: 3001
    });

    mockPrisma.user.update.mockResolvedValue({
      id: "user-1",
      onboardingCompletedAt: new Date("2026-07-04T12:00:00.000Z")
    });

    const response = await app.inject({
      method: "PATCH",
      url: "/api/me/onboarding",
      headers: {
        authorization: `Bearer ${token}`
      },
      payload: {}
    });

    expect(response.statusCode).toBe(200);
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: {
        id: "user-1"
      },
      data: {
        onboardingCompletedAt: expect.any(Date)
      }
    });

    await app.close();
  });
});
