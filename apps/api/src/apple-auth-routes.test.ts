import { beforeEach, describe, expect, it, vi } from "vitest";

const mockAppleAuth = vi.hoisted(() => ({
  createAppleAuthorizationUrl: vi.fn(),
  exchangeAppleCodeForIdToken: vi.fn(),
  isAppleAuthConfigured: vi.fn(),
  isAppleEmailVerified: vi.fn(),
  verifyAppleIdToken: vi.fn()
}));

const mockResolveOAuthUser = vi.hoisted(() => vi.fn());

const mockTx = vi.hoisted(() => ({
  oAuthStateToken: {
    findUnique: vi.fn(),
    updateMany: vi.fn()
  }
}));

const mockPrisma = vi.hoisted(() => ({
  $transaction: vi.fn(),
  oAuthStateToken: {
    create: vi.fn()
  }
}));

vi.mock("@kupitnezabyt/database", () => ({
  cancelPendingItemCheckReminders: vi.fn(),
  markShoppingListItemBought: vi.fn(),
  prisma: mockPrisma,
  setItemStatus: vi.fn(),
  upsertItemCheckReminder: vi.fn()
}));

vi.mock("./apple-auth.js", () => mockAppleAuth);

vi.mock("./oauth.js", () => ({
  resolveOAuthUser: mockResolveOAuthUser
}));

describe("apple auth routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env.APP_BASE_URL = "http://localhost:3000";
    process.env.JWT_SECRET = "test-secret";
    process.env.NODE_ENV = "test";
    process.env.APPLE_CLIENT_ID = "com.example.web";
    process.env.APPLE_TEAM_ID = "TEAM123456";
    process.env.APPLE_KEY_ID = "KEY123456";
    process.env.APPLE_PRIVATE_KEY = "private-key";
    process.env.APPLE_REDIRECT_URI = "http://localhost:3001/api/auth/apple/callback";

    mockPrisma.$transaction.mockImplementation((callback) => callback(mockTx));
    mockAppleAuth.isAppleAuthConfigured.mockReturnValue(true);
    mockAppleAuth.isAppleEmailVerified.mockReturnValue(true);
    mockAppleAuth.createAppleAuthorizationUrl.mockReturnValue(
      "https://appleid.apple.com/auth/authorize"
    );
  });

  it("creates OAuth state and returns an Apple authorization URL", async () => {
    const { buildServer } = await import("./server.js");
    const app = buildServer();

    mockPrisma.oAuthStateToken.create.mockResolvedValue({});

    const response = await app.inject({
      method: "POST",
      url: "/api/auth/apple/start"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      authUrl: "https://appleid.apple.com/auth/authorize"
    });
    expect(mockPrisma.oAuthStateToken.create).toHaveBeenCalledWith({
      data: {
        provider: "APPLE",
        stateHash: expect.any(String),
        nonceHash: expect.any(String),
        expiresAt: expect.any(Date)
      }
    });
    expect(mockAppleAuth.createAppleAuthorizationUrl).toHaveBeenCalledWith(
      expect.objectContaining({
        appleClientId: "com.example.web"
      }),
      expect.any(String),
      expect.any(String)
    );

    await app.close();
  });

  it("handles an Apple callback and redirects with the app bearer token", async () => {
    const { hashOAuthSecret } = await import("./auth.js");
    const { buildServer } = await import("./server.js");
    const app = buildServer();

    mockTx.oAuthStateToken.findUnique.mockResolvedValue({
      id: "state-1",
      provider: "APPLE",
      nonceHash: hashOAuthSecret("nonce-1", {
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
        appleClientId: "com.example.web",
        appleTeamId: "TEAM123456",
        appleKeyId: "KEY123456",
        applePrivateKey: "private-key",
        appleRedirectUri: "http://localhost:3001/api/auth/apple/callback",
        telegramBotToken: undefined,
        port: 3001
      }),
      expiresAt: new Date(Date.now() + 60_000),
      consumedAt: null
    });
    mockTx.oAuthStateToken.updateMany.mockResolvedValue({ count: 1 });
    mockAppleAuth.exchangeAppleCodeForIdToken.mockResolvedValue("id-token");
    mockAppleAuth.verifyAppleIdToken.mockResolvedValue({
      iss: "https://appleid.apple.com",
      aud: "com.example.web",
      exp: Math.floor(Date.now() / 1000) + 60,
      sub: "apple-user-1",
      email: "user@example.com",
      email_verified: "true",
      nonce: "nonce-1"
    });
    mockResolveOAuthUser.mockResolvedValue({
      id: "user-1",
      email: "user@example.com",
      displayName: null
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/auth/apple/callback",
      headers: {
        "content-type": "application/x-www-form-urlencoded"
      },
      payload: new URLSearchParams({
        code: "code-1",
        state: "state-raw"
      }).toString()
    });

    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toContain("http://localhost:3000/?oauth_token=");
    expect(mockTx.oAuthStateToken.updateMany).toHaveBeenCalledWith({
      where: {
        id: "state-1",
        consumedAt: null
      },
      data: {
        consumedAt: expect.any(Date)
      }
    });
    expect(mockResolveOAuthUser).toHaveBeenCalledWith(
      mockTx,
      {
        provider: "APPLE",
        providerAccountId: "apple-user-1",
        email: "user@example.com",
        emailVerified: true,
        displayName: null
      },
      expect.any(Date)
    );

    await app.close();
  });
});
