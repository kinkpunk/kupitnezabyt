import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGoogleAuth = vi.hoisted(() => ({
  createGoogleAuthorizationUrl: vi.fn(),
  exchangeGoogleCodeForIdToken: vi.fn(),
  isGoogleAuthConfigured: vi.fn(),
  verifyGoogleIdToken: vi.fn()
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

vi.mock("./google-auth.js", () => mockGoogleAuth);

vi.mock("./oauth.js", () => ({
  resolveOAuthUser: mockResolveOAuthUser
}));

describe("google auth routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env.APP_BASE_URL = "http://localhost:3000";
    process.env.JWT_SECRET = "test-secret";
    process.env.NODE_ENV = "test";
    process.env.GOOGLE_CLIENT_ID = "google-client-id";
    process.env.GOOGLE_CLIENT_SECRET = "google-client-secret";
    process.env.GOOGLE_REDIRECT_URI = "http://localhost:3001/api/auth/google/callback";

    mockPrisma.$transaction.mockImplementation((callback) => callback(mockTx));
    mockGoogleAuth.isGoogleAuthConfigured.mockReturnValue(true);
    mockGoogleAuth.createGoogleAuthorizationUrl.mockReturnValue(
      "https://accounts.google.com/o/oauth2/v2/auth"
    );
  });

  it("creates OAuth state and returns a Google authorization URL", async () => {
    const { buildServer } = await import("./server.js");
    const app = buildServer();

    mockPrisma.oAuthStateToken.create.mockResolvedValue({});

    const response = await app.inject({
      method: "POST",
      url: "/api/auth/google/start"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      authUrl: "https://accounts.google.com/o/oauth2/v2/auth"
    });
    expect(mockPrisma.oAuthStateToken.create).toHaveBeenCalledWith({
      data: {
        provider: "GOOGLE",
        stateHash: expect.any(String),
        nonceHash: expect.any(String),
        expiresAt: expect.any(Date)
      }
    });
    expect(mockGoogleAuth.createGoogleAuthorizationUrl).toHaveBeenCalledWith(
      expect.objectContaining({
        googleClientId: "google-client-id"
      }),
      expect.any(String),
      expect.any(String)
    );

    await app.close();
  });

  it("handles a Google callback and redirects with the app bearer token", async () => {
    const { hashOAuthSecret } = await import("./auth.js");
    const { buildServer } = await import("./server.js");
    const app = buildServer();

    mockTx.oAuthStateToken.findUnique.mockResolvedValue({
      id: "state-1",
      provider: "GOOGLE",
      nonceHash: hashOAuthSecret("nonce-1", {
        appBaseUrl: "http://localhost:3000",
        emailFrom: undefined,
        emailProviderApiKey: undefined,
        jwtSecret: "test-secret",
        magicLinkTokenTtlMinutes: 15,
        nodeEnv: "test",
        devAuthEnabled: false,
        googleClientId: "google-client-id",
        googleClientSecret: "google-client-secret",
        googleRedirectUri: "http://localhost:3001/api/auth/google/callback",
        telegramBotToken: undefined,
        port: 3001
      }),
      expiresAt: new Date(Date.now() + 60_000),
      consumedAt: null
    });
    mockTx.oAuthStateToken.updateMany.mockResolvedValue({ count: 1 });
    mockGoogleAuth.exchangeGoogleCodeForIdToken.mockResolvedValue("id-token");
    mockGoogleAuth.verifyGoogleIdToken.mockResolvedValue({
      iss: "https://accounts.google.com",
      aud: "google-client-id",
      exp: Math.floor(Date.now() / 1000) + 60,
      sub: "google-user-1",
      email: "user@example.com",
      email_verified: true,
      name: "Alice",
      nonce: "nonce-1"
    });
    mockResolveOAuthUser.mockResolvedValue({
      id: "user-1",
      email: "user@example.com",
      displayName: "Alice"
    });

    const response = await app.inject({
      method: "GET",
      url: "/api/auth/google/callback?code=code-1&state=state-raw"
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
        provider: "GOOGLE",
        providerAccountId: "google-user-1",
        email: "user@example.com",
        emailVerified: true,
        displayName: "Alice"
      },
      expect.any(Date)
    );

    await app.close();
  });
});
