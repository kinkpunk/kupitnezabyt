import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  $transaction: vi.fn(),
  category: {
    delete: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn()
  },
  item: {
    delete: vi.fn(),
    findFirst: vi.fn()
  },
  checkSession: {
    findFirst: vi.fn(),
    update: vi.fn()
  },
  itemGroup: {
    update: vi.fn()
  },
  shoppingListItem: {
    findUniqueOrThrow: vi.fn()
  }
}));

const mockMarkShoppingListItemBought = vi.hoisted(() => vi.fn());

const mockTx = vi.hoisted(() => ({
  category: {
    update: vi.fn()
  },
  item: {
    create: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn()
  },
  recommendationDismissal: {
    deleteMany: vi.fn()
  },
  shoppingListItem: {
    create: vi.fn(),
    updateMany: vi.fn()
  },
  checkSession: {
    update: vi.fn()
  },
  itemGroup: {
    update: vi.fn()
  }
}));

vi.mock("@kupitnezabyt/database", () => ({
  cancelPendingItemCheckReminders: vi.fn(),
  ensurePersonalWorkspace: vi.fn(),
  getPersonalWorkspaceId: (userId: string) => `workspace_${userId}`,
  markShoppingListItemBought: mockMarkShoppingListItemBought,
  prisma: mockPrisma,
  setItemStatus: vi.fn(),
  upsertItemCheckReminder: vi.fn()
}));

describe("archive routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JWT_SECRET = "test-secret";
  });

  it("restores only items archived by the same category archive action", async () => {
    const archivedAt = new Date("2026-06-20T10:00:00.000Z");
    const { buildServer } = await import("./server.js");
    const { signToken } = await import("./auth.js");
    const app = buildServer();

    mockPrisma.category.findFirst.mockResolvedValue({
      id: "category-1",
      userId: "user-1",
      name: "Аптека",
      icon: null,
      sortOrder: 0,
      archivedAt
    });
    mockPrisma.$transaction.mockImplementation((callback) => callback(mockTx));
    mockTx.item.findMany
      .mockResolvedValueOnce([
        {
          id: "item-1",
          userId: "user-1",
          categoryId: "category-1",
          name: "Ибупрофен",
          status: "IN_STOCK",
          nextCheckAt: null
        }
      ])
      .mockResolvedValueOnce([{ status: "IN_STOCK" }]);
    mockTx.category.update.mockResolvedValue({});
    mockTx.item.updateMany.mockResolvedValue({ count: 1 });

    const token = signToken(
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

    const response = await app.inject({
      method: "POST",
      url: "/api/categories/category-1/restore",
      headers: {
        authorization: `Bearer ${token}`
      }
    });

    expect(response.statusCode).toBe(200);
    expect(mockTx.item.findMany).toHaveBeenNthCalledWith(1, {
      where: {
        workspaceId: "workspace_user-1",
        categoryId: "category-1",
        archivedAt
      }
    });
    expect(mockTx.item.updateMany).toHaveBeenCalledWith({
      where: {
        workspaceId: "workspace_user-1",
        categoryId: "category-1",
        archivedAt
      },
      data: {
        archivedAt: null
      }
    });

    await app.close();
  });

  it("deletes archived categories only", async () => {
    const { buildServer } = await import("./server.js");
    const { signToken } = await import("./auth.js");
    const app = buildServer();

    mockPrisma.category.findFirst.mockResolvedValue({
      id: "category-1",
      userId: "user-1",
      archivedAt: new Date("2026-06-20T10:00:00.000Z")
    });
    mockPrisma.category.delete.mockResolvedValue({});

    const response = await app.inject({
      method: "DELETE",
      url: "/api/categories/category-1",
      headers: {
        authorization: `Bearer ${createToken(signToken)}`
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ deleted: true });
    expect(mockPrisma.category.findFirst).toHaveBeenCalledWith({
      where: {
        id: "category-1",
        workspaceId: "workspace_user-1"
      }
    });
    expect(mockPrisma.category.delete).toHaveBeenCalledWith({
      where: {
        id: "category-1"
      }
    });

    await app.close();
  });

  it("rejects active category deletes with an explicit archive-first contract", async () => {
    const { buildServer } = await import("./server.js");
    const { signToken } = await import("./auth.js");
    const app = buildServer();

    mockPrisma.category.findFirst.mockResolvedValue({
      id: "category-1",
      userId: "user-1",
      archivedAt: null
    });

    const response = await app.inject({
      method: "DELETE",
      url: "/api/categories/category-1",
      headers: {
        authorization: `Bearer ${createToken(signToken)}`
      }
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({
      error: {
        code: "CATEGORY_NOT_ARCHIVED"
      }
    });
    expect(mockPrisma.category.delete).not.toHaveBeenCalled();

    await app.close();
  });

  it("reorders active categories owned by the authenticated user", async () => {
    const { buildServer } = await import("./server.js");
    const { signToken } = await import("./auth.js");
    const app = buildServer();

    mockPrisma.category.findMany
      .mockResolvedValueOnce([{ id: "category-1" }, { id: "category-2" }])
      .mockResolvedValueOnce([
        {
          id: "category-2",
          name: "Дом",
          icon: null,
          sortOrder: 0,
          archivedAt: null,
          items: [{ status: "IN_STOCK" }]
        },
        {
          id: "category-1",
          name: "Аптека",
          icon: null,
          sortOrder: 1,
          archivedAt: null,
          items: []
        }
      ]);
    mockPrisma.$transaction.mockImplementation((callback) => callback(mockTx));
    mockTx.category.update.mockResolvedValue({});

    const response = await app.inject({
      method: "POST",
      url: "/api/categories/reorder",
      headers: {
        authorization: `Bearer ${createToken(signToken)}`
      },
      payload: {
        categoryIds: ["category-2", "category-1"]
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([
      expect.objectContaining({
        id: "category-2",
        itemCount: 1,
        aggregateStatus: "OK"
      }),
      expect.objectContaining({
        id: "category-1",
        itemCount: 0,
        aggregateStatus: "OK"
      })
    ]);
    expect(mockPrisma.category.findMany).toHaveBeenNthCalledWith(1, {
      where: {
        workspaceId: "workspace_user-1",
        archivedAt: null
      },
      select: {
        id: true
      }
    });
    expect(mockTx.category.update).toHaveBeenNthCalledWith(1, {
      where: {
        id: "category-2"
      },
      data: {
        sortOrder: 0
      }
    });
    expect(mockTx.category.update).toHaveBeenNthCalledWith(2, {
      where: {
        id: "category-1"
      },
      data: {
        sortOrder: 1
      }
    });

    await app.close();
  });

  it("does not reorder categories outside the authenticated user scope", async () => {
    const { buildServer } = await import("./server.js");
    const { signToken } = await import("./auth.js");
    const app = buildServer();

    mockPrisma.category.findMany.mockResolvedValueOnce([{ id: "category-1" }]);

    const response = await app.inject({
      method: "POST",
      url: "/api/categories/reorder",
      headers: {
        authorization: `Bearer ${createToken(signToken)}`
      },
      payload: {
        categoryIds: ["category-1", "other-user-category"]
      }
    });

    expect(response.statusCode).toBe(404);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();

    await app.close();
  });

  it("requires category reorder payloads to include every active category", async () => {
    const { buildServer } = await import("./server.js");
    const { signToken } = await import("./auth.js");
    const app = buildServer();

    mockPrisma.category.findMany.mockResolvedValueOnce([
      { id: "category-1" },
      { id: "category-2" }
    ]);

    const response = await app.inject({
      method: "POST",
      url: "/api/categories/reorder",
      headers: {
        authorization: `Bearer ${createToken(signToken)}`
      },
      payload: {
        categoryIds: ["category-1"]
      }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      error: {
        code: "CATEGORY_ORDER_INCOMPLETE"
      }
    });
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();

    await app.close();
  });

  it("deletes archived items only", async () => {
    const { buildServer } = await import("./server.js");
    const { signToken } = await import("./auth.js");
    const app = buildServer();

    mockPrisma.item.findFirst.mockResolvedValue({
      id: "item-1",
      userId: "user-1",
      archivedAt: new Date("2026-06-20T10:00:00.000Z")
    });
    mockPrisma.item.delete.mockResolvedValue({});

    const response = await app.inject({
      method: "DELETE",
      url: "/api/items/item-1",
      headers: {
        authorization: `Bearer ${createToken(signToken)}`
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ deleted: true });
    expect(mockPrisma.item.findFirst).toHaveBeenCalledWith({
      where: {
        id: "item-1",
        workspaceId: "workspace_user-1"
      }
    });
    expect(mockPrisma.item.delete).toHaveBeenCalledWith({
      where: {
        id: "item-1"
      }
    });

    await app.close();
  });

  it("rejects active item deletes with an explicit archive-first contract", async () => {
    const { buildServer } = await import("./server.js");
    const { signToken } = await import("./auth.js");
    const app = buildServer();

    mockPrisma.item.findFirst.mockResolvedValue({
      id: "item-1",
      userId: "user-1",
      archivedAt: null
    });

    const response = await app.inject({
      method: "DELETE",
      url: "/api/items/item-1",
      headers: {
        authorization: `Bearer ${createToken(signToken)}`
      }
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({
      error: {
        code: "ITEM_NOT_ARCHIVED"
      }
    });
    expect(mockPrisma.item.delete).not.toHaveBeenCalled();

    await app.close();
  });

  it("returns the completed shopping entry with item data", async () => {
    const { buildServer } = await import("./server.js");
    const { signToken } = await import("./auth.js");
    const app = buildServer();

    mockPrisma.$transaction.mockImplementation((callback) => callback(mockTx));
    mockMarkShoppingListItemBought.mockResolvedValue({ id: "shopping-1" });
    mockPrisma.shoppingListItem.findUniqueOrThrow.mockResolvedValue({
      id: "shopping-1",
      item: {
        id: "item-1",
        name: "Кофе"
      }
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/shopping-list/shopping-1/complete",
      headers: {
        authorization: `Bearer ${createToken(signToken)}`
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().item).toEqual({
      id: "item-1",
      name: "Кофе"
    });
    expect(mockPrisma.shoppingListItem.findUniqueOrThrow).toHaveBeenCalledWith({
      where: {
        id: "shopping-1"
      },
      include: {
        category: true,
        item: true
      }
    });

    await app.close();
  });

  it("clears matching recommendation dismissals when archiving an item", async () => {
    const { buildServer } = await import("./server.js");
    const { signToken } = await import("./auth.js");
    const app = buildServer();

    mockPrisma.item.findFirst.mockResolvedValue({
      id: "item-1",
      userId: "user-1",
      categoryId: "category-1",
      name: "Кофе",
      createdAt: new Date("2026-06-20T10:00:00.000Z"),
      lastBoughtAt: null,
      archivedAt: null
    });
    mockPrisma.$transaction.mockImplementation((callback) => callback(mockTx));
    mockTx.item.findMany.mockResolvedValue([{ id: "item-1", name: "Кофе" }]);
    mockTx.recommendationDismissal.deleteMany.mockResolvedValue({ count: 1 });
    mockTx.shoppingListItem.updateMany.mockResolvedValue({ count: 0 });
    mockTx.item.update.mockResolvedValue({});

    const response = await app.inject({
      method: "POST",
      url: "/api/items/item-1/archive",
      headers: {
        authorization: `Bearer ${createToken(signToken)}`
      }
    });

    expect(response.statusCode).toBe(200);
    expect(mockTx.recommendationDismissal.deleteMany).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        workspaceId: "workspace_user-1",
        OR: [
          { ruleId: "coffee-basics", suggestedItem: "Фильтры для кофе" },
          { ruleId: "coffee-basics", suggestedItem: "*" },
          { ruleId: "coffee-basics", suggestedItem: "Молоко" },
          { ruleId: "coffee-basics", suggestedItem: "Овсяное молоко" }
        ]
      }
    });

    await app.close();
  });

  it("creates new items as need-buy shopping entries", async () => {
    const { buildServer } = await import("./server.js");
    const { signToken } = await import("./auth.js");
    const app = buildServer();

    mockPrisma.category.findFirst.mockResolvedValue({
      id: "category-1",
      userId: "user-1",
      archivedAt: null
    });
    mockPrisma.$transaction.mockImplementation((callback) => callback(mockTx));
    mockTx.item.create.mockResolvedValue({
      id: "item-1",
      userId: "user-1",
      categoryId: "category-1",
      name: "Кофе",
      status: "NEED_BUY"
    });
    mockTx.shoppingListItem.create.mockResolvedValue({});

    const response = await app.inject({
      method: "POST",
      url: "/api/items",
      headers: {
        authorization: `Bearer ${createToken(signToken)}`
      },
      payload: {
        categoryId: "category-1",
        name: "Кофе"
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().status).toBe("NEED_BUY");
    expect(mockTx.item.create).toHaveBeenCalledWith({
      data: {
        userId: "user-1",
        workspaceId: "workspace_user-1",
        categoryId: "category-1",
        name: "Кофе",
        status: "NEED_BUY",
        brand: null,
        notes: null,
        usageCycleDays: null
      }
    });
    expect(mockTx.shoppingListItem.create).toHaveBeenCalledWith({
      data: {
        userId: "user-1",
        workspaceId: "workspace_user-1",
        itemId: "item-1",
        title: "Кофе",
        categoryId: "category-1",
        priority: "NORMAL"
      }
    });

    await app.close();
  });
});

describe("check session routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JWT_SECRET = "test-secret";
  });

  it("returns the latest active check session for the authenticated user", async () => {
    const { buildServer } = await import("./server.js");
    const { signToken } = await import("./auth.js");
    const app = buildServer();
    const activeSession = {
      id: "session-1",
      userId: "user-1",
      categoryId: "category-1",
      groupId: null,
      status: "IN_PROGRESS",
      items: []
    };

    mockPrisma.checkSession.findFirst.mockResolvedValue(activeSession);

    const response = await app.inject({
      method: "GET",
      url: "/api/check/session/active",
      headers: {
        authorization: `Bearer ${createToken(signToken)}`
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(activeSession);
    expect(mockPrisma.checkSession.findFirst).toHaveBeenCalledWith({
      where: {
        workspaceId: "workspace_user-1",
        status: "IN_PROGRESS"
      },
      include: expect.any(Object),
      orderBy: {
        startedAt: "desc"
      }
    });

    await app.close();
  });

  it("reschedules a category after completing its check session", async () => {
    vi.useFakeTimers({
      now: new Date("2026-06-24T10:00:00.000Z")
    });
    const { buildServer } = await import("./server.js");
    const { signToken } = await import("./auth.js");
    const app = buildServer();

    mockPrisma.checkSession.findFirst.mockResolvedValue({
      id: "session-1",
      userId: "user-1",
      categoryId: "category-1",
      groupId: null,
      status: "IN_PROGRESS"
    });
    mockPrisma.$transaction.mockImplementation((callback) => callback(mockTx));
    mockTx.checkSession.update.mockResolvedValue({
      id: "session-1",
      userId: "user-1",
      categoryId: "category-1",
      groupId: null,
      status: "COMPLETED",
      category: {
        id: "category-1",
        usageCycleDays: 7
      },
      group: null,
      items: []
    });
    mockTx.category.update.mockResolvedValue({});

    const response = await app.inject({
      method: "POST",
      url: "/api/check/session/session-1/complete",
      headers: {
        authorization: `Bearer ${createToken(signToken)}`
      }
    });

    expect(response.statusCode).toBe(200);
    expect(mockTx.category.update).toHaveBeenCalledWith({
      where: {
        id: "category-1"
      },
      data: {
        nextCheckAt: new Date("2026-07-01T10:00:00.000Z")
      }
    });

    await app.close();
    vi.useRealTimers();
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
