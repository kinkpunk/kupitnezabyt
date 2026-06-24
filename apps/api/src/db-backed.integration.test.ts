import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "@kupitnezabyt/database";

const shouldRunDbIntegration =
  process.env.RUN_DB_INTEGRATION_TESTS === "1" && Boolean(process.env.DATABASE_URL);

describe.skipIf(!shouldRunDbIntegration)("DB-backed API integration", () => {
  let app: FastifyInstance;
  let prisma: PrismaClient;
  let signToken: typeof import("./auth.js").signToken;
  const createdUserIds = new Set<string>();

  beforeAll(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET ?? "integration-secret";
    const databaseModule = await import("@kupitnezabyt/database");
    const serverModule = await import("./server.js");
    const authModule = await import("./auth.js");

    prisma = databaseModule.prisma;
    app = serverModule.buildServer();
    signToken = authModule.signToken;
  });

  afterEach(async () => {
    if (createdUserIds.size === 0) {
      return;
    }

    await prisma.user.deleteMany({
      where: {
        id: {
          in: [...createdUserIds]
        }
      }
    });
    createdUserIds.clear();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it("keeps item and shopping-list flows isolated by authenticated user", async () => {
    const suffix = Date.now().toString(36);
    const [owner, otherUser] = await Promise.all([
      prisma.user.create({
        data: {
          email: `owner-${suffix}@example.com`,
          emailVerifiedAt: new Date(),
          language: "ru",
          timezone: "Europe/Minsk"
        }
      }),
      prisma.user.create({
        data: {
          email: `other-${suffix}@example.com`,
          emailVerifiedAt: new Date(),
          language: "ru",
          timezone: "Europe/Minsk"
        }
      })
    ]);
    createdUserIds.add(owner.id);
    createdUserIds.add(otherUser.id);

    const ownerToken = createToken(owner.id);
    const otherToken = createToken(otherUser.id);

    const categoryResponse = await app.inject({
      method: "POST",
      url: "/api/categories",
      headers: {
        authorization: `Bearer ${ownerToken}`
      },
      payload: {
        name: "Integration category"
      }
    });
    expect(categoryResponse.statusCode).toBe(200);
    const category = categoryResponse.json<{ id: string }>();

    const itemResponse = await app.inject({
      method: "POST",
      url: "/api/items",
      headers: {
        authorization: `Bearer ${ownerToken}`
      },
      payload: {
        categoryId: category.id,
        name: "Integration coffee"
      }
    });
    expect(itemResponse.statusCode).toBe(200);
    const item = itemResponse.json<{ id: string }>();

    const forbiddenStatusResponse = await app.inject({
      method: "POST",
      url: `/api/items/${item.id}/status`,
      headers: {
        authorization: `Bearer ${otherToken}`
      },
      payload: {
        status: "URGENT"
      }
    });
    expect(forbiddenStatusResponse.statusCode).toBe(404);

    const statusResponse = await app.inject({
      method: "POST",
      url: `/api/items/${item.id}/status`,
      headers: {
        authorization: `Bearer ${ownerToken}`
      },
      payload: {
        status: "URGENT"
      }
    });
    expect(statusResponse.statusCode).toBe(200);

    const ownerShoppingItems = await prisma.shoppingListItem.findMany({
      where: {
        userId: owner.id,
        itemId: item.id,
        isCompleted: false
      }
    });
    expect(ownerShoppingItems).toHaveLength(1);
    expect(ownerShoppingItems[0]?.priority).toBe("URGENT");

    const otherShoppingItems = await prisma.shoppingListItem.findMany({
      where: {
        userId: otherUser.id,
        itemId: item.id
      }
    });
    expect(otherShoppingItems).toHaveLength(0);
  });

  function createToken(userId: string): string {
    return signToken(userId, {
      appBaseUrl: "http://localhost:3000",
      devAuthEnabled: false,
      emailFrom: undefined,
      emailProviderApiKey: undefined,
      jwtSecret: process.env.JWT_SECRET ?? "integration-secret",
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
});
