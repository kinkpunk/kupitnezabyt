import cors from "@fastify/cors";
import { prisma } from "@kupitnezabyt/database";
import { isItemStatus } from "@kupitnezabyt/shared";
import Fastify from "fastify";

import { getBearerToken, signToken, validateTelegramInitData, verifyToken } from "./auth.js";
import type { TelegramUser } from "./auth.js";
import { getConfig } from "./env.js";
import { markShoppingListItemBought, setItemStatus } from "./services.js";

type NamedBody = {
  name?: unknown;
  icon?: unknown;
};

type CreateItemBody = {
  categoryId?: unknown;
  name?: unknown;
  brand?: unknown;
  notes?: unknown;
  usageCycleDays?: unknown;
};

type StatusBody = {
  status?: unknown;
};

type DevAuthBody = {
  telegramUserId?: unknown;
  firstName?: unknown;
};

type TelegramAuthBody = {
  initData?: unknown;
};

const config = getConfig();

export function buildServer() {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? "info",
      redact: ["req.headers.authorization", "req.body.initData"]
    }
  });

  void app.register(cors, {
    origin: config.appBaseUrl,
    credentials: true
  });

  app.addHook("preHandler", async (request, reply) => {
    if (request.url === "/health" || request.url.startsWith("/api/auth/")) {
      return;
    }

    const token = getBearerToken(request);
    const payload = token ? verifyToken(token, config) : null;
    if (!payload) {
      await reply.code(401).send({ error: "UNAUTHORIZED" });
      return;
    }

    request.userId = payload.sub;
  });

  app.get("/health", async () => ({ ok: true }));

  app.post<{ Body: DevAuthBody }>("/api/auth/dev", async (request, reply) => {
    if (config.nodeEnv !== "development" || !config.devAuthEnabled) {
      await reply.code(404).send({ error: "NOT_FOUND" });
      return;
    }

    const telegramUserId =
      typeof request.body?.telegramUserId === "string" && request.body.telegramUserId.trim()
        ? `dev:${request.body.telegramUserId.trim()}`
        : "dev:local";
    const firstName =
      typeof request.body?.firstName === "string" && request.body.firstName.trim()
        ? request.body.firstName.trim()
        : "Dev";

    const user = await prisma.user.upsert({
      where: { telegramUserId },
      update: { firstName },
      create: {
        telegramUserId,
        firstName,
        language: "ru",
        timezone: "Europe/Minsk"
      }
    });

    return {
      token: signToken(user.id, config),
      user
    };
  });

  app.post<{ Body: TelegramAuthBody }>("/api/auth/telegram", async (request, reply) => {
    if (typeof request.body?.initData !== "string" || !config.telegramBotToken) {
      await reply.code(400).send({ error: "INVALID_TELEGRAM_AUTH" });
      return;
    }

    const telegramUser = validateTelegramInitData(
      request.body.initData,
      config.telegramBotToken
    );

    if (!telegramUser) {
      await reply.code(401).send({ error: "INVALID_TELEGRAM_AUTH" });
      return;
    }

    const user = await upsertTelegramUser(telegramUser);
    return {
      token: signToken(user.id, config),
      user
    };
  });

  app.get("/api/me", async (request) => {
    return prisma.user.findUniqueOrThrow({
      where: {
        id: requireUserId(request.userId)
      }
    });
  });

  app.get("/api/categories", async (request) => {
    return prisma.category.findMany({
      where: {
        userId: requireUserId(request.userId),
        archivedAt: null
      },
      include: {
        _count: {
          select: {
            items: true
          }
        }
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
    });
  });

  app.post<{ Body: NamedBody }>("/api/categories", async (request, reply) => {
    const name = readRequiredString(request.body?.name);
    if (!name) {
      await reply.code(400).send({ error: "NAME_REQUIRED" });
      return;
    }

    const userId = requireUserId(request.userId);
    const categoryCount = await prisma.category.count({
      where: {
        userId
      }
    });

    return prisma.category.create({
      data: {
        userId,
        name,
        icon: readOptionalString(request.body?.icon) ?? null,
        sortOrder: categoryCount
      }
    });
  });

  app.get<{ Params: { id: string } }>("/api/categories/:id", async (request, reply) => {
    const category = await prisma.category.findFirst({
      where: {
        id: request.params.id,
        userId: requireUserId(request.userId),
        archivedAt: null
      },
      include: {
        items: {
          where: {
            archivedAt: null
          },
          orderBy: {
            createdAt: "asc"
          }
        }
      }
    });

    if (!category) {
      await reply.code(404).send({ error: "CATEGORY_NOT_FOUND" });
      return;
    }

    return category;
  });

  app.patch<{ Body: NamedBody; Params: { id: string } }>(
    "/api/categories/:id",
    async (request, reply) => {
      const name = readRequiredString(request.body?.name);
      if (!name) {
        await reply.code(400).send({ error: "NAME_REQUIRED" });
        return;
      }

      const category = await prisma.category.findFirst({
        where: {
          id: request.params.id,
          userId: requireUserId(request.userId),
          archivedAt: null
        }
      });

      if (!category) {
        await reply.code(404).send({ error: "CATEGORY_NOT_FOUND" });
        return;
      }

      return prisma.category.update({
        where: {
          id: category.id
        },
        data: {
          name,
          icon: readOptionalString(request.body?.icon) ?? null
        }
      });
    }
  );

  app.get<{ Querystring: { categoryId?: string } }>("/api/items", async (request) => {
    const categoryId = readOptionalString(request.query.categoryId);

    return prisma.item.findMany({
      where: {
        userId: requireUserId(request.userId),
        ...(categoryId ? { categoryId } : {}),
        archivedAt: null
      },
      include: {
        category: true
      },
      orderBy: {
        createdAt: "asc"
      }
    });
  });

  app.post<{ Body: CreateItemBody }>("/api/items", async (request, reply) => {
    const userId = requireUserId(request.userId);
    const categoryId = readRequiredString(request.body?.categoryId);
    const name = readRequiredString(request.body?.name);

    if (!categoryId || !name) {
      await reply.code(400).send({ error: "CATEGORY_AND_NAME_REQUIRED" });
      return;
    }

    const category = await prisma.category.findFirst({
      where: {
        id: categoryId,
        userId,
        archivedAt: null
      }
    });

    if (!category) {
      await reply.code(404).send({ error: "CATEGORY_NOT_FOUND" });
      return;
    }

    return prisma.item.create({
      data: {
        userId,
        categoryId,
        name,
        brand: readOptionalString(request.body?.brand) ?? null,
        notes: readOptionalString(request.body?.notes) ?? null,
        usageCycleDays: readOptionalPositiveInteger(request.body?.usageCycleDays) ?? null
      }
    });
  });

  app.post<{ Body: StatusBody; Params: { id: string } }>(
    "/api/items/:id/status",
    async (request, reply) => {
      const status = request.body?.status;
      if (typeof status !== "string" || !isItemStatus(status)) {
        await reply.code(400).send({ error: "INVALID_STATUS" });
        return;
      }

      try {
        return await prisma.$transaction((tx) =>
          setItemStatus(tx, requireUserId(request.userId), request.params.id, status)
        );
      } catch (error) {
        if (error instanceof Error && error.message === "ITEM_NOT_FOUND") {
          await reply.code(404).send({ error: "ITEM_NOT_FOUND" });
          return;
        }

        throw error;
      }
    }
  );

  app.get("/api/shopping-list", async (request) => {
    return prisma.shoppingListItem.findMany({
      where: {
        userId: requireUserId(request.userId),
        isCompleted: false
      },
      include: {
        category: true,
        item: true
      },
      orderBy: [{ priority: "desc" }, { createdAt: "asc" }]
    });
  });

  app.post<{ Params: { id: string } }>(
    "/api/shopping-list/:id/complete",
    async (request, reply) => {
      try {
        return await prisma.$transaction((tx) =>
          markShoppingListItemBought(tx, requireUserId(request.userId), request.params.id)
        );
      } catch (error) {
        if (error instanceof Error && error.message === "SHOPPING_LIST_ITEM_NOT_FOUND") {
          await reply.code(404).send({ error: "SHOPPING_LIST_ITEM_NOT_FOUND" });
          return;
        }

        throw error;
      }
    }
  );

  return app;
}

async function upsertTelegramUser(telegramUser: TelegramUser) {
  return prisma.user.upsert({
    where: {
      telegramUserId: String(telegramUser.id)
    },
    update: {
      telegramUsername: telegramUser.username ?? null,
      firstName: telegramUser.first_name ?? null,
      language: telegramUser.language_code ?? "ru"
    },
    create: {
      telegramUserId: String(telegramUser.id),
      telegramUsername: telegramUser.username ?? null,
      firstName: telegramUser.first_name ?? null,
      language: telegramUser.language_code ?? "ru",
      timezone: "Europe/Minsk"
    }
  });
}

function requireUserId(userId: string | undefined): string {
  if (!userId) {
    throw new Error("Missing auth context");
  }

  return userId;
}

function readRequiredString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function readOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function readOptionalPositiveInteger(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return undefined;
  }

  return parsed;
}
