import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  $transaction: vi.fn(),
  category: {
    delete: vi.fn(),
    findFirst: vi.fn()
  },
  item: {
    delete: vi.fn(),
    findFirst: vi.fn()
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
    findMany: vi.fn(),
    updateMany: vi.fn()
  }
}));

vi.mock("@kupitnezabyt/database", () => ({
  cancelPendingItemCheckReminders: vi.fn(),
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
        jwtSecret: "test-secret",
        nodeEnv: "test",
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
        userId: "user-1",
        categoryId: "category-1",
        archivedAt
      }
    });
    expect(mockTx.item.updateMany).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
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
        userId: "user-1",
        archivedAt: {
          not: null
        }
      }
    });
    expect(mockPrisma.category.delete).toHaveBeenCalledWith({
      where: {
        id: "category-1"
      }
    });

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
        userId: "user-1",
        archivedAt: {
          not: null
        }
      }
    });
    expect(mockPrisma.item.delete).toHaveBeenCalledWith({
      where: {
        id: "item-1"
      }
    });

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
});

function createToken(signToken: typeof import("./auth.js").signToken): string {
  return signToken(
    "user-1",
    {
      appBaseUrl: "http://localhost:3000",
      devAuthEnabled: false,
      jwtSecret: "test-secret",
      nodeEnv: "test",
      port: 3001,
      telegramBotToken: undefined
    }
  );
}
