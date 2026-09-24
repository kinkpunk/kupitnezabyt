import { beforeEach, describe, expect, it, vi } from "vitest";

const mockSendMagicLinkEmail = vi.hoisted(() => vi.fn());

const mockTx = vi.hoisted(() => ({
  magicLinkToken: {
    findUnique: vi.fn(),
    updateMany: vi.fn()
  },
  user: {
    findUnique: vi.fn(),
    upsert: vi.fn()
  },
  workspace: {
    upsert: vi.fn()
  },
  workspaceMember: {
    upsert: vi.fn()
  }
}));

const mockPrisma = vi.hoisted(() => ({
  $transaction: vi.fn(),
  magicLinkToken: {
    create: vi.fn()
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

vi.mock("./email.js", () => ({
  sendMagicLinkEmail: mockSendMagicLinkEmail,
  sendWorkspaceInvitationEmail: vi.fn()
}));

describe("email auth routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env.APP_BASE_URL = "http://localhost:3000";
    process.env.JWT_SECRET = "test-secret";
    process.env.MAGIC_LINK_TOKEN_TTL_MINUTES = "15";
    process.env.NODE_ENV = "test";

    mockPrisma.$transaction.mockImplementation((callback) => callback(mockTx));
    mockSendMagicLinkEmail.mockResolvedValue({
      devMagicLink: "http://localhost:3000/?magic_token=dev-token"
    });
  });

  it("creates and sends a magic link without revealing whether an account exists", async () => {
    const { buildServer } = await import("./server.js");
    const app = buildServer();

    mockPrisma.magicLinkToken.create.mockResolvedValue({});

    const response = await app.inject({
      method: "POST",
      url: "/api/auth/email/request",
      payload: {
        email: " USER@Example.COM "
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      sent: true,
      devMagicLink: "http://localhost:3000/?magic_token=dev-token"
    });
    expect(mockPrisma.magicLinkToken.create).toHaveBeenCalledWith({
      data: {
        email: "user@example.com",
        expiresAt: expect.any(Date),
        tokenHash: expect.any(String)
      }
    });
    expect(mockSendMagicLinkEmail).toHaveBeenCalledWith({
      config: expect.objectContaining({
        appBaseUrl: "http://localhost:3000"
      }),
      email: "user@example.com",
      magicLink: expect.stringContaining("http://localhost:3000/?magic_token=")
    });

    await app.close();
  });

  it("verifies a valid magic link exactly once", async () => {
    const { buildServer } = await import("./server.js");
    const app = buildServer();

    mockTx.magicLinkToken.findUnique.mockResolvedValue({
      id: "magic-1",
      email: "user@example.com",
      expiresAt: new Date(Date.now() + 60_000),
      consumedAt: null
    });
    mockTx.magicLinkToken.updateMany.mockResolvedValue({ count: 1 });
    mockTx.user.upsert.mockResolvedValue({
      id: "user-1",
      email: "user@example.com"
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/auth/email/verify",
      payload: {
        token: "raw-token"
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().token).toEqual(expect.any(String));
    expect(response.json().user).toEqual({
      id: "user-1",
      email: "user@example.com"
    });
    expect(mockTx.magicLinkToken.updateMany).toHaveBeenCalledWith({
      where: {
        id: "magic-1",
        consumedAt: null
      },
      data: {
        consumedAt: expect.any(Date)
      }
    });
    expect(mockTx.user.upsert).toHaveBeenCalledWith({
      where: {
        email: "user@example.com"
      },
      update: {
        emailVerifiedAt: expect.any(Date)
      },
      create: {
        email: "user@example.com",
        emailVerifiedAt: expect.any(Date),
        language: "ru",
        timezone: "Europe/Minsk"
      }
    });

    await app.close();
  });

  it("records legal consent when verifying a magic link for a new user", async () => {
    const { buildServer } = await import("./server.js");
    const app = buildServer();

    mockTx.magicLinkToken.findUnique.mockResolvedValue({
      id: "magic-1",
      email: "user@example.com",
      expiresAt: new Date(Date.now() + 60_000),
      consumedAt: null
    });
    mockTx.magicLinkToken.updateMany.mockResolvedValue({ count: 1 });
    mockTx.user.findUnique.mockResolvedValue(null);
    mockTx.user.upsert.mockResolvedValue({
      id: "user-1",
      email: "user@example.com",
      termsAcceptedAt: new Date("2026-09-23T10:00:00.000Z"),
      privacyAcceptedAt: new Date("2026-09-23T10:00:00.000Z")
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/auth/email/verify",
      payload: {
        token: "raw-token",
        consent: {
          termsVersion: "1.0.0",
          privacyVersion: "1.0.0",
          acceptedAt: "2026-09-23T10:00:00.000Z"
        }
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().consentRecorded).toBe(true);
    expect(mockTx.user.upsert).toHaveBeenCalledWith({
      where: {
        email: "user@example.com"
      },
      update: {
        emailVerifiedAt: expect.any(Date),
        termsAcceptedAt: expect.any(Date),
        termsAcceptedVersion: "1.0.0",
        privacyAcceptedAt: expect.any(Date),
        privacyAcceptedVersion: "1.0.0"
      },
      create: {
        email: "user@example.com",
        emailVerifiedAt: expect.any(Date),
        language: "ru",
        timezone: "Europe/Minsk",
        termsAcceptedAt: expect.any(Date),
        termsAcceptedVersion: "1.0.0",
        privacyAcceptedAt: expect.any(Date),
        privacyAcceptedVersion: "1.0.0"
      }
    });

    await app.close();
  });

  it("does not overwrite existing consent when the versions match", async () => {
    const { buildServer } = await import("./server.js");
    const app = buildServer();

    mockTx.magicLinkToken.findUnique.mockResolvedValue({
      id: "magic-1",
      email: "user@example.com",
      expiresAt: new Date(Date.now() + 60_000),
      consumedAt: null
    });
    mockTx.magicLinkToken.updateMany.mockResolvedValue({ count: 1 });
    mockTx.user.findUnique.mockResolvedValue({
      termsAcceptedAt: new Date("2026-09-20T10:00:00.000Z"),
      termsAcceptedVersion: "1.0.0",
      privacyAcceptedAt: new Date("2026-09-20T10:00:00.000Z"),
      privacyAcceptedVersion: "1.0.0"
    });
    mockTx.user.upsert.mockResolvedValue({
      id: "user-1",
      email: "user@example.com",
      termsAcceptedAt: new Date("2026-09-20T10:00:00.000Z"),
      privacyAcceptedAt: new Date("2026-09-20T10:00:00.000Z")
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/auth/email/verify",
      payload: {
        token: "raw-token",
        consent: {
          termsVersion: "1.0.0",
          privacyVersion: "1.0.0",
          acceptedAt: "2026-09-23T10:00:00.000Z"
        }
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().consentRecorded).toBe(true);
    expect(mockTx.user.upsert).toHaveBeenCalledWith({
      where: {
        email: "user@example.com"
      },
      update: {
        emailVerifiedAt: expect.any(Date)
      },
      create: expect.any(Object)
    });

    await app.close();
  });

  it("rejects expired or already consumed magic links", async () => {
    const { buildServer } = await import("./server.js");
    const app = buildServer();

    mockTx.magicLinkToken.findUnique.mockResolvedValue({
      id: "magic-1",
      email: "user@example.com",
      expiresAt: new Date(Date.now() - 60_000),
      consumedAt: null
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/auth/email/verify",
      payload: {
        token: "raw-token"
      }
    });

    expect(response.statusCode).toBe(401);
    expect(mockTx.magicLinkToken.updateMany).not.toHaveBeenCalled();
    expect(mockTx.user.upsert).not.toHaveBeenCalled();

    await app.close();
  });
});
