import cors from "@fastify/cors";
import { prisma } from "@kupitnezabyt/database";
import {
  aggregateCategoryStatus,
  calculateNextCheckAt,
  calculateSnoozedUntil,
  isItemStatus
} from "@kupitnezabyt/shared";
import Fastify from "fastify";
import type { FastifyReply } from "fastify";

import { getBearerToken, signToken, validateTelegramInitData, verifyToken } from "./auth.js";
import type { TelegramUser } from "./auth.js";
import { getConfig } from "./env.js";
import { cancelPendingItemCheckReminders, markShoppingListItemBought, setItemStatus, upsertItemCheckReminder } from "./services.js";

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

type UpdateItemBody = {
  categoryId?: unknown;
  name?: unknown;
  brand?: unknown;
  notes?: unknown;
  usageCycleDays?: unknown;
};

type StatusBody = {
  status?: unknown;
};

type SnoozeBody = {
  days?: unknown;
};

type DevAuthBody = {
  telegramUserId?: unknown;
  firstName?: unknown;
};

type TelegramAuthBody = {
  initData?: unknown;
};

type ShoppingListBody = {
  title?: unknown;
  categoryId?: unknown;
  priority?: unknown;
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
      await sendError(reply, 401, "UNAUTHORIZED", "Authorization is required.");
      return;
    }

    request.userId = payload.sub;
  });

  app.get("/health", async () => ({ ok: true }));

  app.post<{ Body: DevAuthBody }>("/api/auth/dev", async (request, reply) => {
    if (config.nodeEnv !== "development" || !config.devAuthEnabled) {
      await sendError(reply, 404, "NOT_FOUND", "Development auth is not enabled.");
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
      await sendError(reply, 400, "INVALID_TELEGRAM_AUTH", "Telegram init data is invalid.");
      return;
    }

    const telegramUser = validateTelegramInitData(
      request.body.initData,
      config.telegramBotToken
    );

    if (!telegramUser) {
      await sendError(reply, 401, "INVALID_TELEGRAM_AUTH", "Telegram init data is invalid.");
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
    const categories = await prisma.category.findMany({
      where: {
        userId: requireUserId(request.userId),
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

    return categories.map(({ items: categoryItems, ...category }) => ({
      ...category,
      itemCount: categoryItems.length,
      aggregateStatus: aggregateCategoryStatus(categoryItems)
    }));
  });

  app.post<{ Body: NamedBody }>("/api/categories", async (request, reply) => {
    const name = readRequiredString(request.body?.name);
    if (!name) {
      await sendError(reply, 400, "NAME_REQUIRED", "Category name is required.");
      return;
    }

    const userId = requireUserId(request.userId);
    const categoryCount = await prisma.category.count({
      where: {
        userId
      }
    });

    const category = await prisma.category.create({
      data: {
        userId,
        name,
        icon: readOptionalString(request.body?.icon) ?? null,
        sortOrder: categoryCount
      }
    });

    return {
      ...category,
      itemCount: 0,
      aggregateStatus: "OK"
    };
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
      await sendError(reply, 404, "CATEGORY_NOT_FOUND", "Category was not found.");
      return;
    }

    return category;
  });

  app.patch<{ Body: NamedBody; Params: { id: string } }>(
    "/api/categories/:id",
    async (request, reply) => {
      const name = readRequiredString(request.body?.name);
      if (!name) {
        await sendError(reply, 400, "NAME_REQUIRED", "Category name is required.");
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
        await sendError(reply, 404, "CATEGORY_NOT_FOUND", "Category was not found.");
        return;
      }

      const updatedCategory = await prisma.category.update({
        where: {
          id: category.id
        },
        data: {
          name,
          icon: readOptionalString(request.body?.icon) ?? null
        }
      });

      const categoryItems = await prisma.item.findMany({
        where: {
          categoryId: category.id,
          userId: requireUserId(request.userId),
          archivedAt: null
        },
        select: {
          status: true
        }
      });

      return {
        ...updatedCategory,
        itemCount: categoryItems.length,
        aggregateStatus: aggregateCategoryStatus(categoryItems)
      };
    }
  );

  app.post<{ Params: { id: string } }>("/api/categories/:id/archive", async (request, reply) => {
    const userId = requireUserId(request.userId);
    const now = new Date();
    const category = await prisma.category.findFirst({
      where: {
        id: request.params.id,
        userId,
        archivedAt: null
      }
    });

    if (!category) {
      await sendError(reply, 404, "CATEGORY_NOT_FOUND", "Category was not found.");
      return;
    }

    return prisma.$transaction(async (tx) => {
      await tx.item.updateMany({
        where: {
          userId,
          categoryId: category.id,
          archivedAt: null
        },
        data: {
          archivedAt: now
        }
      });

      await tx.shoppingListItem.updateMany({
        where: {
          userId,
          categoryId: category.id,
          isCompleted: false
        },
        data: {
          isCompleted: true,
          completedAt: now
        }
      });

      return tx.category.update({
        where: {
          id: category.id
        },
        data: {
          archivedAt: now
        }
      });
    });
  });

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
      await sendError(
        reply,
        400,
        "CATEGORY_AND_NAME_REQUIRED",
        "Category and item name are required."
      );
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
      await sendError(reply, 404, "CATEGORY_NOT_FOUND", "Category was not found.");
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

  app.get<{ Params: { id: string } }>("/api/items/:id", async (request, reply) => {
    const item = await prisma.item.findFirst({
      where: {
        id: request.params.id,
        userId: requireUserId(request.userId),
        archivedAt: null
      },
      include: {
        category: true
      }
    });

    if (!item) {
      await sendError(reply, 404, "ITEM_NOT_FOUND", "Item was not found.");
      return;
    }

    return item;
  });

  app.patch<{ Body: UpdateItemBody; Params: { id: string } }>(
    "/api/items/:id",
    async (request, reply) => {
      const userId = requireUserId(request.userId);
      const item = await prisma.item.findFirst({
        where: {
          id: request.params.id,
          userId,
          archivedAt: null
        }
      });

      if (!item) {
        await sendError(reply, 404, "ITEM_NOT_FOUND", "Item was not found.");
        return;
      }

      const name = readRequiredString(request.body?.name);
      if (!name) {
        await sendError(reply, 400, "NAME_REQUIRED", "Item name is required.");
        return;
      }

      const categoryId = readOptionalString(request.body?.categoryId);
      if (categoryId) {
        const category = await prisma.category.findFirst({
          where: {
            id: categoryId,
            userId,
            archivedAt: null
          }
        });

        if (!category) {
          await sendError(reply, 404, "CATEGORY_NOT_FOUND", "Category was not found.");
          return;
        }
      }

      const nextCategoryId = categoryId ?? item.categoryId;
      const usageCycleDays = hasOwnProperty(request.body, "usageCycleDays")
        ? readOptionalPositiveInteger(request.body.usageCycleDays) ?? null
        : item.usageCycleDays;
      const brand = hasOwnProperty(request.body, "brand")
        ? readOptionalString(request.body.brand) ?? null
        : item.brand;
      const notes = hasOwnProperty(request.body, "notes")
        ? readOptionalString(request.body.notes) ?? null
        : item.notes;
      const now = new Date();
      return prisma.$transaction(async (tx) => {
        const updatedItem = await tx.item.update({
          where: {
            id: item.id
          },
          data: {
            name,
            categoryId: nextCategoryId,
            brand,
            notes,
            usageCycleDays,
            nextCheckAt: calculateNextCheckAt(item.status, now, usageCycleDays)
          }
        });

        await tx.shoppingListItem.updateMany({
          where: {
            userId,
            itemId: item.id,
            isCompleted: false
          },
          data: {
            title: updatedItem.name,
            categoryId: nextCategoryId
          }
        });

        return updatedItem;
      });
    }
  );

  app.post<{ Body: StatusBody; Params: { id: string } }>(
    "/api/items/:id/status",
    async (request, reply) => {
      const status = request.body?.status;
      if (typeof status !== "string" || !isItemStatus(status)) {
        await sendError(reply, 400, "INVALID_STATUS", "Item status is invalid.");
        return;
      }

      try {
        return await prisma.$transaction((tx) =>
          setItemStatus(tx, requireUserId(request.userId), request.params.id, status)
        );
      } catch (error) {
        if (error instanceof Error && error.message === "ITEM_NOT_FOUND") {
          await sendError(reply, 404, "ITEM_NOT_FOUND", "Item was not found.");
          return;
        }

        throw error;
      }
    }
  );

  app.post<{ Body: SnoozeBody; Params: { id: string } }>(
    "/api/items/:id/snooze",
    async (request, reply) => {
      const userId = requireUserId(request.userId);
      const days = readOptionalPositiveInteger(request.body?.days);
      if (!days) {
        await sendError(reply, 400, "SNOOZE_DAYS_REQUIRED", "Positive snooze days are required.");
        return;
      }

      const item = await prisma.item.findFirst({
        where: {
          id: request.params.id,
          userId,
          archivedAt: null
        }
      });

      if (!item) {
        await sendError(reply, 404, "ITEM_NOT_FOUND", "Item was not found.");
        return;
      }

      if (!item.reminderEnabled || item.status === "PAUSED") {
        await sendError(
          reply,
          400,
          "REMINDER_NOT_AVAILABLE",
          "Item reminders are disabled or paused."
        );
        return;
      }

      const nextCheckAt = calculateSnoozedUntil(new Date(), days);
      return prisma.$transaction(async (tx) => {
        await cancelPendingItemCheckReminders(tx, userId, item.id);
        await upsertItemCheckReminder(tx, {
          userId,
          itemId: item.id,
          scheduledFor: nextCheckAt
        });

        return tx.item.update({
          where: {
            id: item.id
          },
          data: {
            nextCheckAt
          }
        });
      });
    }
  );

  app.post<{ Params: { id: string } }>("/api/items/:id/archive", async (request, reply) => {
    const userId = requireUserId(request.userId);
    const now = new Date();
    const item = await prisma.item.findFirst({
      where: {
        id: request.params.id,
        userId,
        archivedAt: null
      }
    });

    if (!item) {
      await sendError(reply, 404, "ITEM_NOT_FOUND", "Item was not found.");
      return;
    }

    return prisma.$transaction(async (tx) => {
      await tx.shoppingListItem.updateMany({
        where: {
          userId,
          itemId: item.id,
          isCompleted: false
        },
        data: {
          isCompleted: true,
          completedAt: now
        }
      });

      return tx.item.update({
        where: {
          id: item.id
        },
        data: {
          archivedAt: now
        }
      });
    });
  });

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

  app.post<{ Body: ShoppingListBody }>("/api/shopping-list", async (request, reply) => {
    const userId = requireUserId(request.userId);
    const title = readRequiredString(request.body?.title);
    if (!title) {
      await sendError(reply, 400, "TITLE_REQUIRED", "Shopping list title is required.");
      return;
    }

    const categoryId = readOptionalString(request.body?.categoryId);
    if (categoryId) {
      const category = await prisma.category.findFirst({
        where: {
          id: categoryId,
          userId,
          archivedAt: null
        }
      });

      if (!category) {
        await sendError(reply, 404, "CATEGORY_NOT_FOUND", "Category was not found.");
        return;
      }
    }

    const priority = readShoppingPriority(request.body?.priority);
    if (!priority) {
      await sendError(reply, 400, "INVALID_PRIORITY", "Shopping list priority is invalid.");
      return;
    }

    return prisma.shoppingListItem.create({
      data: {
        userId,
        title,
        categoryId: categoryId ?? null,
        priority
      },
      include: {
        category: true,
        item: true
      }
    });
  });

  app.patch<{ Body: ShoppingListBody; Params: { id: string } }>(
    "/api/shopping-list/:id",
    async (request, reply) => {
      const userId = requireUserId(request.userId);
      const shoppingListItem = await prisma.shoppingListItem.findFirst({
        where: {
          id: request.params.id,
          userId,
          isCompleted: false
        }
      });

      if (!shoppingListItem) {
        await sendError(
          reply,
          404,
          "SHOPPING_LIST_ITEM_NOT_FOUND",
          "Shopping list item was not found."
        );
        return;
      }

      if (shoppingListItem.itemId) {
        await sendError(
          reply,
          400,
          "TRACKED_ENTRY_MANAGED_BY_ITEM",
          "Tracked shopping list entries are managed by item status."
        );
        return;
      }

      const title = readRequiredString(request.body?.title);
      if (!title) {
        await sendError(reply, 400, "TITLE_REQUIRED", "Shopping list title is required.");
        return;
      }

      const categoryId = hasOwnProperty(request.body, "categoryId")
        ? readOptionalString(request.body.categoryId) ?? null
        : shoppingListItem.categoryId;
      if (categoryId) {
        const category = await prisma.category.findFirst({
          where: {
            id: categoryId,
            userId,
            archivedAt: null
          }
        });

        if (!category) {
          await sendError(reply, 404, "CATEGORY_NOT_FOUND", "Category was not found.");
          return;
        }
      }

      const priority = hasOwnProperty(request.body, "priority")
        ? readShoppingPriority(request.body.priority)
        : shoppingListItem.priority;
      if (!priority) {
        await sendError(reply, 400, "INVALID_PRIORITY", "Shopping list priority is invalid.");
        return;
      }

      return prisma.shoppingListItem.update({
        where: {
          id: shoppingListItem.id
        },
        data: {
          title,
          categoryId,
          priority
        },
        include: {
          category: true,
          item: true
        }
      });
    }
  );

  app.post<{ Params: { id: string } }>(
    "/api/shopping-list/:id/complete",
    async (request, reply) => {
      try {
        return await prisma.$transaction((tx) =>
          markShoppingListItemBought(tx, requireUserId(request.userId), request.params.id)
        );
      } catch (error) {
        if (error instanceof Error && error.message === "SHOPPING_LIST_ITEM_NOT_FOUND") {
          await sendError(
            reply,
            404,
            "SHOPPING_LIST_ITEM_NOT_FOUND",
            "Shopping list item was not found."
          );
          return;
        }

        throw error;
      }
    }
  );

  app.delete<{ Params: { id: string } }>("/api/shopping-list/:id", async (request, reply) => {
    const userId = requireUserId(request.userId);
    const shoppingListItem = await prisma.shoppingListItem.findFirst({
      where: {
        id: request.params.id,
        userId,
        isCompleted: false
      }
    });

    if (!shoppingListItem) {
      await sendError(
        reply,
        404,
        "SHOPPING_LIST_ITEM_NOT_FOUND",
        "Shopping list item was not found."
      );
      return;
    }

    if (shoppingListItem.itemId) {
      await sendError(
        reply,
        400,
        "TRACKED_ENTRY_MANAGED_BY_ITEM",
        "Tracked shopping list entries are managed by item status."
      );
      return;
    }

    await prisma.shoppingListItem.delete({
      where: {
        id: shoppingListItem.id
      }
    });

    return {
      deleted: true
    };
  });

  app.delete("/api/shopping-list/completed", async (request) => {
    const result = await prisma.shoppingListItem.deleteMany({
      where: {
        userId: requireUserId(request.userId),
        isCompleted: true
      }
    });

    return {
      deletedCount: result.count
    };
  });

  return app;
}

async function sendError(
  reply: FastifyReply,
  statusCode: number,
  code: string,
  message: string
): Promise<void> {
  await reply.code(statusCode).send({
    error: {
      code,
      message
    }
  });
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

function readShoppingPriority(value: unknown): "NORMAL" | "URGENT" | null {
  if (value === undefined || value === null || value === "") {
    return "NORMAL";
  }

  return value === "NORMAL" || value === "URGENT" ? value : null;
}

function hasOwnProperty<TObject extends object, TKey extends PropertyKey>(
  value: TObject,
  key: TKey
): value is TObject & Record<TKey, unknown> {
  return Object.prototype.hasOwnProperty.call(value, key);
}
