import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  category: {
    findMany: vi.fn()
  },
  checkSession: {
    findMany: vi.fn()
  },
  item: {
    findMany: vi.fn()
  },
  itemGroup: {
    findMany: vi.fn()
  },
  recommendationDismissal: {
    findMany: vi.fn()
  },
  reminder: {
    findMany: vi.fn()
  },
  shoppingListItem: {
    findMany: vi.fn()
  },
  user: {
    findUniqueOrThrow: vi.fn()
  },
  workspace: {
    findMany: vi.fn()
  },
  workspaceMember: {
    findMany: vi.fn()
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

describe("privacy export routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env.APP_BASE_URL = "http://localhost:3000";
    process.env.JWT_SECRET = "test-secret";
    process.env.NODE_ENV = "test";

    mockPrisma.user.findUniqueOrThrow.mockResolvedValue({
      id: "user-1",
      email: "user@example.com"
    });
    mockPrisma.category.findMany.mockResolvedValue([]);
    mockPrisma.item.findMany.mockResolvedValue([]);
    mockPrisma.shoppingListItem.findMany.mockResolvedValue([]);
    mockPrisma.reminder.findMany.mockResolvedValue([]);
    mockPrisma.itemGroup.findMany.mockResolvedValue([]);
    mockPrisma.checkSession.findMany.mockResolvedValue([]);
    mockPrisma.recommendationDismissal.findMany.mockResolvedValue([]);
    mockPrisma.workspaceMember.findMany.mockResolvedValue([
      {
        id: "membership-1",
        workspaceId: "workspace-shared",
        role: "EDITOR",
        invitedEmail: "user@example.com",
        invitedAt: new Date("2026-06-25T09:00:00.000Z"),
        joinedAt: new Date("2026-06-25T10:00:00.000Z"),
        createdAt: new Date("2026-06-25T09:00:00.000Z"),
        updatedAt: new Date("2026-06-25T10:00:00.000Z")
      }
    ]);
    mockPrisma.workspace.findMany.mockResolvedValue([
      {
        id: "workspace_user-1",
        name: "Личный список",
        ownerId: "user-1",
        createdAt: new Date("2026-06-25T08:00:00.000Z"),
        updatedAt: new Date("2026-06-25T08:00:00.000Z"),
        _count: {
          members: 1
        }
      }
    ]);
  });

  it("exports only user-owned records plus workspace metadata", async () => {
    const { buildServer } = await import("./server.js");
    const { signToken } = await import("./auth.js");
    const app = buildServer();

    const response = await app.inject({
      method: "GET",
      url: "/api/export/json",
      headers: {
        authorization: `Bearer ${createToken(signToken, "user-1")}`
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.workspaceMemberships).toHaveLength(1);
    expect(response.json().data.ownedWorkspaces).toHaveLength(1);
    expect(mockPrisma.item.findMany).toHaveBeenCalledWith({
      where: {
        userId: "user-1"
      },
      orderBy: {
        createdAt: "asc"
      }
    });
    expect(mockPrisma.workspaceMember.findMany).toHaveBeenCalledWith({
      where: {
        userId: "user-1"
      },
      select: {
        id: true,
        workspaceId: true,
        role: true,
        invitedEmail: true,
        invitedAt: true,
        joinedAt: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: {
        createdAt: "asc"
      }
    });
    expect(mockPrisma.workspace.findMany).toHaveBeenCalledWith({
      where: {
        ownerId: "user-1"
      },
      select: {
        id: true,
        name: true,
        ownerId: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            members: true
          }
        }
      },
      orderBy: {
        createdAt: "asc"
      }
    });

    await app.close();
  });
});

function createToken(signToken: typeof import("./auth.js").signToken, userId: string): string {
  return signToken(userId, {
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
  });
}
