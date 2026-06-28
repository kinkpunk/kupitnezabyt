import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  $transaction: vi.fn(),
  category: {
    count: vi.fn(),
    create: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn()
  },
  item: {
    create: vi.fn(),
    findMany: vi.fn()
  },
  itemGroup: {
    findMany: vi.fn()
  },
  shoppingListItem: {
    create: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn()
  },
  workspaceMember: {
    findFirst: vi.fn()
  }
}));

const mockTx = vi.hoisted(() => ({
  item: {
    create: vi.fn()
  },
  shoppingListItem: {
    create: vi.fn()
  }
}));
const mockUpsertItemCheckReminder = vi.hoisted(() => vi.fn());

vi.mock("@kupitnezabyt/database", () => ({
  cancelPendingItemCheckReminders: vi.fn(),
  ensurePersonalWorkspace: vi.fn(),
  getPersonalWorkspaceId: (userId: string) => `workspace_${userId}`,
  markShoppingListItemBought: vi.fn(),
  prisma: mockPrisma,
  setItemStatus: vi.fn(),
  upsertItemCheckReminder: mockUpsertItemCheckReminder
}));

describe("workspace access routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JWT_SECRET = "test-secret";
    mockPrisma.$transaction.mockImplementation((callback) => callback(mockTx));
  });

  it("lists categories from an active shared workspace for members", async () => {
    const { buildServer } = await import("./server.js");
    const { signToken } = await import("./auth.js");
    const app = buildServer();

    mockPrisma.workspaceMember.findFirst.mockResolvedValue({
      role: "EDITOR",
      workspaceId: "workspace-shared"
    });
    mockPrisma.category.findMany.mockResolvedValue([
      {
        id: "category-1",
        workspaceId: "workspace-shared",
        name: "Дом",
        icon: null,
        sortOrder: 0,
        archivedAt: null,
        items: [{ status: "LOW" }]
      }
    ]);

    const response = await app.inject({
      method: "GET",
      url: "/api/categories",
      headers: {
        authorization: `Bearer ${createToken(signToken, "member-1")}`,
        "x-workspace-id": "workspace-shared"
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([
      expect.objectContaining({
        id: "category-1",
        itemCount: 1,
        aggregateStatus: "ATTENTION"
      })
    ]);
    expect(mockPrisma.category.findMany).toHaveBeenCalledWith({
      where: {
        workspaceId: "workspace-shared",
        archivedAt: null
      },
      include: {
        items: {
          where: {
            archivedAt: null
          },
          select: {
            status: true
          }
        }
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
    });

    await app.close();
  });

  it("creates categories in an active shared workspace for editors", async () => {
    const { buildServer } = await import("./server.js");
    const { signToken } = await import("./auth.js");
    const app = buildServer();

    mockPrisma.workspaceMember.findFirst.mockResolvedValue({
      role: "EDITOR",
      workspaceId: "workspace-shared"
    });
    mockPrisma.category.count.mockResolvedValue(2);
    mockPrisma.category.create.mockResolvedValue({
      id: "category-3",
      userId: "member-1",
      workspaceId: "workspace-shared",
      name: "Аптека",
      icon: null,
      sortOrder: 2,
      archivedAt: null
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/categories",
      headers: {
        authorization: `Bearer ${createToken(signToken, "member-1")}`,
        "x-workspace-id": "workspace-shared"
      },
      payload: {
        name: "Аптека"
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(
      expect.objectContaining({
        id: "category-3",
        workspaceId: "workspace-shared",
        itemCount: 0,
        aggregateStatus: "OK"
      })
    );
    expect(mockPrisma.category.create).toHaveBeenCalledWith({
      data: {
        userId: "member-1",
        workspaceId: "workspace-shared",
        name: "Аптека",
        icon: null,
        sortOrder: 2
      }
    });

    await app.close();
  });

  it("rejects category writes for shared workspace viewers", async () => {
    const { buildServer } = await import("./server.js");
    const { signToken } = await import("./auth.js");
    const app = buildServer();

    mockPrisma.workspaceMember.findFirst.mockResolvedValue({
      role: "VIEWER",
      workspaceId: "workspace-shared"
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/categories",
      headers: {
        authorization: `Bearer ${createToken(signToken, "viewer-1")}`,
        "x-workspace-id": "workspace-shared"
      },
      payload: {
        name: "Аптека"
      }
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe("WORKSPACE_WRITE_FORBIDDEN");
    expect(mockPrisma.category.create).not.toHaveBeenCalled();

    await app.close();
  });

  it("creates items and shopping entries inside an active shared workspace", async () => {
    const { buildServer } = await import("./server.js");
    const { signToken } = await import("./auth.js");
    const app = buildServer();

    mockPrisma.workspaceMember.findFirst.mockResolvedValue({
      role: "EDITOR",
      workspaceId: "workspace-shared"
    });
    mockPrisma.category.findFirst.mockResolvedValue({
      id: "category-1",
      workspaceId: "workspace-shared",
      archivedAt: null
    });
    mockTx.item.create.mockResolvedValue({
      id: "item-1",
      userId: "member-1",
      workspaceId: "workspace-shared",
      categoryId: "category-1",
      name: "Кофе",
      status: "NEED_BUY"
    });
    mockTx.shoppingListItem.create.mockResolvedValue({});

    const response = await app.inject({
      method: "POST",
      url: "/api/items",
      headers: {
        authorization: `Bearer ${createToken(signToken, "member-1")}`,
        "x-workspace-id": "workspace-shared"
      },
      payload: {
        categoryId: "category-1",
        name: "Кофе"
      }
    });

    expect(response.statusCode).toBe(200);
    expect(mockPrisma.category.findFirst).toHaveBeenCalledWith({
      where: {
        id: "category-1",
        workspaceId: "workspace-shared",
        archivedAt: null
      }
    });
    expect(mockTx.item.create).toHaveBeenCalledWith({
      data: {
        userId: "member-1",
        workspaceId: "workspace-shared",
        categoryId: "category-1",
        name: "Кофе",
        status: "NEED_BUY",
        brand: null,
        notes: null,
        usageCycleDays: null,
        nextCheckAt: null
      }
    });
    expect(mockTx.shoppingListItem.create).toHaveBeenCalledWith({
      data: {
        userId: "member-1",
        workspaceId: "workspace-shared",
        itemId: "item-1",
        title: "Кофе",
        categoryId: "category-1",
        priority: "NORMAL"
      }
    });

    await app.close();
  });

  it("creates cycle-tracked items as in-stock with a scheduled reminder", async () => {
    const { buildServer } = await import("./server.js");
    const { signToken } = await import("./auth.js");
    const app = buildServer();

    mockPrisma.workspaceMember.findFirst.mockResolvedValue({
      role: "EDITOR",
      workspaceId: "workspace-shared"
    });
    mockPrisma.category.findFirst.mockResolvedValue({
      id: "category-1",
      workspaceId: "workspace-shared",
      archivedAt: null
    });
    mockTx.item.create.mockImplementation(({ data }) =>
      Promise.resolve({
        id: "item-1",
        ...data
      })
    );

    const response = await app.inject({
      method: "POST",
      url: "/api/items",
      headers: {
        authorization: `Bearer ${createToken(signToken, "member-1")}`,
        "x-workspace-id": "workspace-shared"
      },
      payload: {
        categoryId: "category-1",
        name: "Шампунь",
        usageCycleDays: 14
      }
    });

    expect(response.statusCode).toBe(200);
    expect(mockTx.item.create).toHaveBeenCalledWith({
      data: {
        userId: "member-1",
        workspaceId: "workspace-shared",
        categoryId: "category-1",
        name: "Шампунь",
        status: "IN_STOCK",
        brand: null,
        notes: null,
        usageCycleDays: 14,
        nextCheckAt: expect.any(Date)
      }
    });
    expect(mockTx.shoppingListItem.create).not.toHaveBeenCalled();
    expect(mockUpsertItemCheckReminder).toHaveBeenCalledWith(mockTx, {
      userId: "member-1",
      workspaceId: "workspace-shared",
      itemId: "item-1",
      scheduledFor: expect.any(Date)
    });
    const createCall = mockTx.item.create.mock.calls[0]?.[0] as
      | { data?: { nextCheckAt?: Date } }
      | undefined;
    const scheduledFor = createCall?.data?.nextCheckAt;
    expect(scheduledFor).toBeInstanceOf(Date);
    expect(scheduledFor ? scheduledFor.getTime() - Date.now() : 0).toBeGreaterThan(
      13 * 24 * 60 * 60 * 1000
    );
    expect(scheduledFor ? scheduledFor.getTime() - Date.now() : 0).toBeLessThan(
      15 * 24 * 60 * 60 * 1000
    );

    await app.close();
  });

  it("rejects item status writes for shared workspace viewers", async () => {
    const { buildServer } = await import("./server.js");
    const { signToken } = await import("./auth.js");
    const app = buildServer();

    mockPrisma.workspaceMember.findFirst.mockResolvedValue({
      role: "VIEWER",
      workspaceId: "workspace-shared"
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/items/item-1/status",
      headers: {
        authorization: `Bearer ${createToken(signToken, "viewer-1")}`,
        "x-workspace-id": "workspace-shared"
      },
      payload: {
        status: "NEED_BUY"
      }
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe("WORKSPACE_WRITE_FORBIDDEN");

    await app.close();
  });

  it("lists shopping entries from an active shared workspace", async () => {
    const { buildServer } = await import("./server.js");
    const { signToken } = await import("./auth.js");
    const app = buildServer();

    mockPrisma.workspaceMember.findFirst.mockResolvedValue({
      role: "VIEWER",
      workspaceId: "workspace-shared"
    });
    mockPrisma.shoppingListItem.findMany.mockResolvedValue([
      {
        id: "shopping-1",
        workspaceId: "workspace-shared",
        title: "Кофе",
        priority: "NORMAL",
        isCompleted: false,
        category: null,
        item: null
      }
    ]);

    const response = await app.inject({
      method: "GET",
      url: "/api/shopping-list",
      headers: {
        authorization: `Bearer ${createToken(signToken, "viewer-1")}`,
        "x-workspace-id": "workspace-shared"
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([
      expect.objectContaining({
        id: "shopping-1",
        workspaceId: "workspace-shared",
        title: "Кофе"
      })
    ]);
    expect(mockPrisma.shoppingListItem.findMany).toHaveBeenCalledWith({
      where: {
        workspaceId: "workspace-shared",
        isCompleted: false
      },
      include: {
        category: true,
        item: true
      },
      orderBy: [{ priority: "desc" }, { createdAt: "asc" }]
    });

    await app.close();
  });

  it("rejects shopping list writes for shared workspace viewers", async () => {
    const { buildServer } = await import("./server.js");
    const { signToken } = await import("./auth.js");
    const app = buildServer();

    mockPrisma.workspaceMember.findFirst.mockResolvedValue({
      role: "VIEWER",
      workspaceId: "workspace-shared"
    });

    const response = await app.inject({
      method: "PATCH",
      url: "/api/shopping-list/shopping-1",
      headers: {
        authorization: `Bearer ${createToken(signToken, "viewer-1")}`,
        "x-workspace-id": "workspace-shared"
      },
      payload: {
        title: "Кофе",
        priority: "URGENT"
      }
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe("WORKSPACE_WRITE_FORBIDDEN");
    expect(mockPrisma.shoppingListItem.findFirst).not.toHaveBeenCalled();

    await app.close();
  });

  it("updates manual shopping entries inside an active shared workspace", async () => {
    const { buildServer } = await import("./server.js");
    const { signToken } = await import("./auth.js");
    const app = buildServer();

    mockPrisma.workspaceMember.findFirst.mockResolvedValue({
      role: "EDITOR",
      workspaceId: "workspace-shared"
    });
    mockPrisma.shoppingListItem.findFirst.mockResolvedValue({
      id: "shopping-1",
      workspaceId: "workspace-shared",
      itemId: null,
      title: "Кофе",
      categoryId: null,
      priority: "NORMAL",
      isCompleted: false
    });
    mockPrisma.shoppingListItem.update.mockResolvedValue({
      id: "shopping-1",
      workspaceId: "workspace-shared",
      itemId: null,
      title: "Кофе в зернах",
      categoryId: null,
      priority: "URGENT",
      isCompleted: false,
      category: null,
      item: null
    });

    const response = await app.inject({
      method: "PATCH",
      url: "/api/shopping-list/shopping-1",
      headers: {
        authorization: `Bearer ${createToken(signToken, "member-1")}`,
        "x-workspace-id": "workspace-shared"
      },
      payload: {
        title: "Кофе в зернах",
        priority: "URGENT"
      }
    });

    expect(response.statusCode).toBe(200);
    expect(mockPrisma.shoppingListItem.findFirst).toHaveBeenCalledWith({
      where: {
        id: "shopping-1",
        workspaceId: "workspace-shared",
        isCompleted: false
      }
    });
    expect(mockPrisma.shoppingListItem.update).toHaveBeenCalledWith({
      where: {
        id: "shopping-1"
      },
      data: {
        title: "Кофе в зернах",
        categoryId: null,
        priority: "URGENT"
      },
      include: {
        category: true,
        item: true
      }
    });

    await app.close();
  });

  it("lists in-app reminders from an active shared workspace", async () => {
    const { buildServer } = await import("./server.js");
    const { signToken } = await import("./auth.js");
    const app = buildServer();
    const nextCheckAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    mockPrisma.workspaceMember.findFirst.mockResolvedValue({
      role: "VIEWER",
      workspaceId: "workspace-shared"
    });
    mockPrisma.category.findMany.mockResolvedValue([
      {
        id: "category-1",
        name: "Аптека",
        nextCheckAt,
        reminderEnabled: true,
        archivedAt: null
      }
    ]);
    mockPrisma.itemGroup.findMany.mockResolvedValue([]);
    mockPrisma.item.findMany.mockResolvedValue([]);

    const response = await app.inject({
      method: "GET",
      url: "/api/reminders/in-app",
      headers: {
        authorization: `Bearer ${createToken(signToken, "viewer-1")}`,
        "x-workspace-id": "workspace-shared"
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([
      expect.objectContaining({
        entityId: "category-1",
        entityType: "CATEGORY",
        title: "Аптека"
      })
    ]);
    expect(mockPrisma.category.findMany).toHaveBeenCalledWith({
      where: {
        workspaceId: "workspace-shared",
        archivedAt: null
      },
      select: {
        id: true,
        name: true,
        nextCheckAt: true,
        reminderEnabled: true,
        archivedAt: true
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
