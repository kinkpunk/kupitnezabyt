import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  user: {
    delete: vi.fn()
  }
}));

vi.mock("@kupitnezabyt/database", () => ({
  cancelPendingItemCheckReminders: vi.fn(),
  markShoppingListItemBought: vi.fn(),
  prisma: mockPrisma,
  setItemStatus: vi.fn(),
  upsertItemCheckReminder: vi.fn()
}));

describe("sensitive route rate limits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    vi.useRealTimers();
    process.env.APP_BASE_URL = "http://localhost:3000";
    process.env.JWT_SECRET = "test-secret";
    process.env.NODE_ENV = "test";
  });

  it("rate limits account deletion per authenticated user and allows requests after reset", async () => {
    vi.useFakeTimers({
      now: new Date("2026-06-23T10:00:00.000Z")
    });
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

    mockPrisma.user.delete.mockResolvedValue({});

    for (let index = 0; index < 10; index += 1) {
      const response = await app.inject({
        method: "DELETE",
        url: "/api/me",
        headers: {
          authorization: `Bearer ${token}`
        }
      });
      expect(response.statusCode).toBe(200);
    }

    const limitedResponse = await app.inject({
      method: "DELETE",
      url: "/api/me",
      headers: {
        authorization: `Bearer ${token}`
      }
    });
    expect(limitedResponse.statusCode).toBe(429);

    vi.setSystemTime(new Date("2026-06-23T10:15:00.001Z"));
    const resetResponse = await app.inject({
      method: "DELETE",
      url: "/api/me",
      headers: {
        authorization: `Bearer ${token}`
      }
    });
    expect(resetResponse.statusCode).toBe(200);
    expect(mockPrisma.user.delete).toHaveBeenCalledTimes(11);

    await app.close();
    vi.useRealTimers();
  });
});
