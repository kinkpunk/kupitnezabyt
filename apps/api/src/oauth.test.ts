import { beforeEach, describe, expect, it, vi } from "vitest";

import { resolveOAuthUser } from "./oauth.js";

const mockTx = {
  authAccount: {
    create: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn()
  },
  user: {
    create: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn()
  },
  workspace: {
    upsert: vi.fn()
  },
  workspaceMember: {
    upsert: vi.fn()
  }
};

describe("resolveOAuthUser", () => {
  const now = new Date("2026-06-22T12:00:00.000Z");

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses an existing provider account without looking up users by email", async () => {
    mockTx.authAccount.findUnique.mockResolvedValue({
      id: "account-1",
      userId: "user-1"
    });
    mockTx.user.update.mockResolvedValue({
      id: "user-1",
      email: "user@example.com",
      displayName: "Alice"
    });

    await expect(
      resolveOAuthUser(
        mockTx as never,
        {
          provider: "GOOGLE",
          providerAccountId: "google-1",
          email: "USER@Example.COM",
          emailVerified: true,
          displayName: "Alice"
        },
        now
      )
    ).resolves.toEqual({
      id: "user-1",
      email: "user@example.com",
      displayName: "Alice"
    });

    expect(mockTx.user.findUnique).not.toHaveBeenCalled();
    expect(mockTx.authAccount.update).toHaveBeenCalledWith({
      where: {
        id: "account-1"
      },
      data: {
        email: "user@example.com",
        emailVerified: true,
        displayName: "Alice"
      }
    });
  });

  it("links a new provider account to an existing user only for verified email", async () => {
    mockTx.authAccount.findUnique.mockResolvedValue(null);
    mockTx.user.findUnique.mockResolvedValue({
      id: "user-1",
      email: "user@example.com",
      displayName: null
    });
    mockTx.user.update.mockResolvedValue({
      id: "user-1",
      email: "user@example.com",
      displayName: "Alice"
    });

    await resolveOAuthUser(
      mockTx as never,
      {
        provider: "GOOGLE",
        providerAccountId: "google-1",
        email: "USER@Example.COM",
        emailVerified: true,
        displayName: "Alice"
      },
      now
    );

    expect(mockTx.user.findUnique).toHaveBeenCalledWith({
      where: {
        email: "user@example.com"
      },
      select: {
        id: true,
        email: true,
        displayName: true
      }
    });
    expect(mockTx.authAccount.create).toHaveBeenCalledWith({
      data: {
        userId: "user-1",
        provider: "GOOGLE",
        providerAccountId: "google-1",
        email: "user@example.com",
        emailVerified: true,
        displayName: "Alice"
      }
    });
  });

  it("does not auto-link unverified provider email to an existing user", async () => {
    mockTx.authAccount.findUnique.mockResolvedValue(null);
    mockTx.user.create.mockResolvedValue({
      id: "user-2",
      email: null,
      displayName: "Mallory"
    });

    await resolveOAuthUser(
      mockTx as never,
      {
        provider: "GOOGLE",
        providerAccountId: "google-2",
        email: "user@example.com",
        emailVerified: false,
        displayName: "Mallory"
      },
      now
    );

    expect(mockTx.user.findUnique).not.toHaveBeenCalled();
    expect(mockTx.user.create).toHaveBeenCalledWith({
      data: {
        email: null,
        emailVerifiedAt: null,
        displayName: "Mallory",
        language: "ru",
        timezone: "Europe/Minsk"
      },
      select: {
        id: true,
        email: true,
        displayName: true
      }
    });
    expect(mockTx.authAccount.create).toHaveBeenCalledWith({
      data: {
        userId: "user-2",
        provider: "GOOGLE",
        providerAccountId: "google-2",
        email: "user@example.com",
        emailVerified: false,
        displayName: "Mallory"
      }
    });
  });
});
