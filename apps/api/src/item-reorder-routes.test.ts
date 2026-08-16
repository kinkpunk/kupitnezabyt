import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  $transaction: vi.fn(),
  category: {
    findFirst: vi.fn()
  },
  item: {
    findMany: vi.fn()
  },
  workspaceMember: {
    findFirst: vi.fn()
  }
}));

const mockTx = vi.hoisted(() => ({
  item: {
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

describe("item reorder routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JWT_SECRET = "test-secret";
    mockPrisma.$transaction.mockImplementation((callback) => callback(mockTx));
  });

  it("reorders active items in a category", async () => {
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
    mockPrisma.item.findMany
      .mockResolvedValueOnce([
        { id: "item-1" },
        { id: "item-2" }
      ])
      .mockResolvedValueOnce([
        {
          id: "item-2",
          workspaceId: "workspace-shared",
          categoryId: "category-1",
          name: "Рис",
          sortOrder: 0,
          category: { id: "category-1", name: "Продукты" }
        },
        {
          id: "item-1",
          workspaceId: "workspace-shared",
          categoryId: "category-1",
          name: "Кофе",
          sortOrder: 1,
          category: { id: "category-1", name: "Продукты" }
        }
      ]);
    mockTx.item.update.mockResolvedValue({});

    const response = await app.inject({
      method: "POST",
      url: "/api/items/reorder",
      headers: {
        authorization: `Bearer ${createToken(signToken, "member-1")}`,
        "x-workspace-id": "workspace-shared"
      },
      payload: {
        categoryId: "category-1",
        itemIds: ["item-2", "item-1"]
      }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body).toHaveLength(2);
    expect(body[0].id).toBe("item-2");
    expect(body[1].id).toBe("item-1");
    expect(mockTx.item.update).toHaveBeenCalledTimes(2);
    expect(mockTx.item.update).toHaveBeenNthCalledWith(1, {
      where: { id: "item-2" },
      data: { sortOrder: 0 }
    });
    expect(mockTx.item.update).toHaveBeenNthCalledWith(2, {
      where: { id: "item-1" },
      data: { sortOrder: 1 }
    });

    await app.close();
  });

  it("rejects incomplete item order", async () => {
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
    mockPrisma.item.findMany.mockResolvedValue([
      { id: "item-1" },
      { id: "item-2" }
    ]);

    const response = await app.inject({
      method: "POST",
      url: "/api/items/reorder",
      headers: {
        authorization: `Bearer ${createToken(signToken, "member-1")}`,
        "x-workspace-id": "workspace-shared"
      },
      payload: {
        categoryId: "category-1",
        itemIds: ["item-2"]
      }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe("ITEM_ORDER_INCOMPLETE");
    expect(mockTx.item.update).not.toHaveBeenCalled();

    await app.close();
  });

  it("rejects duplicate item ids", async () => {
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
    mockPrisma.item.findMany.mockResolvedValue([
      { id: "item-1" },
      { id: "item-2" }
    ]);

    const response = await app.inject({
      method: "POST",
      url: "/api/items/reorder",
      headers: {
        authorization: `Bearer ${createToken(signToken, "member-1")}`,
        "x-workspace-id": "workspace-shared"
      },
      payload: {
        categoryId: "category-1",
        itemIds: ["item-1", "item-1"]
      }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe("DUPLICATE_ITEM_IDS");
    expect(mockTx.item.update).not.toHaveBeenCalled();

    await app.close();
  });

  it("rejects unknown item ids", async () => {
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
    mockPrisma.item.findMany.mockResolvedValue([{ id: "item-1" }]);

    const response = await app.inject({
      method: "POST",
      url: "/api/items/reorder",
      headers: {
        authorization: `Bearer ${createToken(signToken, "member-1")}`,
        "x-workspace-id": "workspace-shared"
      },
      payload: {
        categoryId: "category-1",
        itemIds: ["item-2"]
      }
    });

    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe("ITEM_NOT_FOUND");
    expect(mockTx.item.update).not.toHaveBeenCalled();

    await app.close();
  });

  it("rejects reorder for workspace viewers", async () => {
    const { buildServer } = await import("./server.js");
    const { signToken } = await import("./auth.js");
    const app = buildServer();

    mockPrisma.workspaceMember.findFirst.mockResolvedValue({
      role: "VIEWER",
      workspaceId: "workspace-shared"
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/items/reorder",
      headers: {
        authorization: `Bearer ${createToken(signToken, "viewer-1")}`,
        "x-workspace-id": "workspace-shared"
      },
      payload: {
        categoryId: "category-1",
        itemIds: ["item-1"]
      }
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe("WORKSPACE_WRITE_FORBIDDEN");
    expect(mockPrisma.item.findMany).not.toHaveBeenCalled();

    await app.close();
  });

  it("rejects reorder for missing category", async () => {
    const { buildServer } = await import("./server.js");
    const { signToken } = await import("./auth.js");
    const app = buildServer();

    mockPrisma.workspaceMember.findFirst.mockResolvedValue({
      role: "EDITOR",
      workspaceId: "workspace-shared"
    });
    mockPrisma.category.findFirst.mockResolvedValue(null);

    const response = await app.inject({
      method: "POST",
      url: "/api/items/reorder",
      headers: {
        authorization: `Bearer ${createToken(signToken, "member-1")}`,
        "x-workspace-id": "workspace-shared"
      },
      payload: {
        categoryId: "category-missing",
        itemIds: ["item-1"]
      }
    });

    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe("CATEGORY_NOT_FOUND");
    expect(mockPrisma.item.findMany).not.toHaveBeenCalled();

    await app.close();
  });
});

describe("GET /api/items sort=status", () => {
  it("sorts active items by status urgency", async () => {
    const { buildServer } = await import("./server.js");
    const { signToken } = await import("./auth.js");
    const app = buildServer();

    mockPrisma.workspaceMember.findFirst.mockResolvedValue({
      role: "EDITOR",
      workspaceId: "workspace-shared"
    });
    mockPrisma.item.findMany.mockResolvedValue([
      {
        id: "item-in-stock",
        workspaceId: "workspace-shared",
        categoryId: "category-1",
        name: "Соль",
        status: "IN_STOCK",
        sortOrder: 0,
        createdAt: new Date("2026-08-15T10:00:00.000Z"),
        category: { id: "category-1", name: "Продукты" }
      },
      {
        id: "item-urgent",
        workspaceId: "workspace-shared",
        categoryId: "category-1",
        name: "Молоко",
        status: "URGENT",
        sortOrder: 1,
        createdAt: new Date("2026-08-15T10:00:00.000Z"),
        category: { id: "category-1", name: "Продукты" }
      },
      {
        id: "item-low",
        workspaceId: "workspace-shared",
        categoryId: "category-1",
        name: "Рис",
        status: "LOW",
        sortOrder: 2,
        createdAt: new Date("2026-08-15T10:00:00.000Z"),
        category: { id: "category-1", name: "Продукты" }
      }
    ]);

    const response = await app.inject({
      method: "GET",
      url: "/api/items?sort=status",
      headers: {
        authorization: `Bearer ${createToken(signToken, "member-1")}`,
        "x-workspace-id": "workspace-shared"
      }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body).toHaveLength(3);
    expect(body.map((item: { id: string }) => item.id)).toEqual([
      "item-urgent",
      "item-low",
      "item-in-stock"
    ]);

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
