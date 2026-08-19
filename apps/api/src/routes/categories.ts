import { prisma } from "@kupitnezabyt/database";
import { aggregateCategoryStatus } from "@kupitnezabyt/shared";
import type { FastifyInstance } from "fastify";

import { syncRestoredItem } from "../lib/restore.js";
import {
  calculateConfiguredNextCheckAt,
  canWriteWorkspace,
  hasOwnProperty,
  readBooleanFlag,
  readNullableDate,
  readOptionalBoolean,
  readOptionalPositiveInteger,
  readOptionalString,
  readRequiredString,
  readStringArray,
  requireUserId,
  resolveWorkspaceAccess,
  sendError
} from "../lib/helpers.js";
import { clearRecommendationDismissalsForItems } from "../lib/recommendations.js";
import type { ArchivedQuery, CheckSettingsBody, NamedBody, ReorderCategoriesBody } from "../lib/types.js";

export default async function categoryRoutes(app: FastifyInstance) {
  app.get<{ Querystring: ArchivedQuery }>("/api/categories", async (request) => {
    const userId = requireUserId(request.userId);
    const workspaceAccess = await resolveWorkspaceAccess(request, userId);
    if (!workspaceAccess) {
      return [];
    }
    const archived = readBooleanFlag(request.query.archived);
    const categories = await prisma.category.findMany({
      where: {
        workspaceId: workspaceAccess.workspaceId,
        archivedAt: archived ? { not: null } : null
      },
      include: {
        items: {
          where: {
            archivedAt: archived ? { not: null } : null
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
    const workspaceAccess = await resolveWorkspaceAccess(request, userId);
    if (!workspaceAccess) {
      await sendError(reply, 404, "WORKSPACE_NOT_FOUND", "Workspace was not found.");
      return;
    }
    if (!canWriteWorkspace(workspaceAccess)) {
      await sendError(reply, 403, "WORKSPACE_WRITE_FORBIDDEN", "Workspace write access is required.");
      return;
    }

    const categoryCount = await prisma.category.count({
      where: {
        workspaceId: workspaceAccess.workspaceId,
        archivedAt: null
      }
    });

    const category = await prisma.category.create({
      data: {
        userId,
        workspaceId: workspaceAccess.workspaceId,
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

  app.post<{ Body: ReorderCategoriesBody }>("/api/categories/reorder", async (request, reply) => {
    const categoryIds = readStringArray(request.body?.categoryIds);
    if (!categoryIds || categoryIds.length === 0) {
      await sendError(reply, 400, "CATEGORY_IDS_REQUIRED", "Category ids are required.");
      return;
    }

    if (new Set(categoryIds).size !== categoryIds.length) {
      await sendError(reply, 400, "DUPLICATE_CATEGORY_IDS", "Category ids must be unique.");
      return;
    }

    const userId = requireUserId(request.userId);
    const workspaceAccess = await resolveWorkspaceAccess(request, userId);
    if (!workspaceAccess) {
      await sendError(reply, 404, "WORKSPACE_NOT_FOUND", "Workspace was not found.");
      return;
    }
    if (!canWriteWorkspace(workspaceAccess)) {
      await sendError(reply, 403, "WORKSPACE_WRITE_FORBIDDEN", "Workspace write access is required.");
      return;
    }

    const categories = await prisma.category.findMany({
      where: {
        workspaceId: workspaceAccess.workspaceId,
        archivedAt: null
      },
      select: {
        id: true
      }
    });
    const ownedCategoryIds = new Set(categories.map((category) => category.id));

    if (categoryIds.some((categoryId) => !ownedCategoryIds.has(categoryId))) {
      await sendError(reply, 404, "CATEGORY_NOT_FOUND", "Category was not found.");
      return;
    }

    if (categories.length !== categoryIds.length) {
      await sendError(
        reply,
        400,
        "CATEGORY_ORDER_INCOMPLETE",
        "Category ids must include every active category."
      );
      return;
    }

    await prisma.$transaction((tx) =>
      Promise.all(
        categoryIds.map((categoryId, index) =>
          tx.category.update({
            where: {
              id: categoryId
            },
            data: {
              sortOrder: index
            }
          })
        )
      )
    );

    const updatedCategories = await prisma.category.findMany({
      where: {
        workspaceId: workspaceAccess.workspaceId,
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

    return updatedCategories.map(({ items: categoryItems, ...category }) => ({
      ...category,
      itemCount: categoryItems.length,
      aggregateStatus: aggregateCategoryStatus(categoryItems)
    }));
  });

  app.get<{ Params: { id: string } }>("/api/categories/:id", async (request, reply) => {
    const userId = requireUserId(request.userId);
    const workspaceAccess = await resolveWorkspaceAccess(request, userId);
    if (!workspaceAccess) {
      await sendError(reply, 404, "CATEGORY_NOT_FOUND", "Category was not found.");
      return;
    }
    const category = await prisma.category.findFirst({
      where: {
        id: request.params.id,
        workspaceId: workspaceAccess.workspaceId,
        archivedAt: null
      },
      include: {
        items: {
          where: {
            archivedAt: null
          },
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
        }
      }
    });

    if (!category) {
      await sendError(reply, 404, "CATEGORY_NOT_FOUND", "Category was not found.");
      return;
    }

    return category;
  });

  app.patch<{ Body: CheckSettingsBody; Params: { id: string } }>(
    "/api/categories/:id",
    async (request, reply) => {
      const userId = requireUserId(request.userId);
      const workspaceAccess = await resolveWorkspaceAccess(request, userId);
      if (!workspaceAccess) {
        await sendError(reply, 404, "CATEGORY_NOT_FOUND", "Category was not found.");
        return;
      }
      if (!canWriteWorkspace(workspaceAccess)) {
        await sendError(reply, 403, "WORKSPACE_WRITE_FORBIDDEN", "Workspace write access is required.");
        return;
      }

      const category = await prisma.category.findFirst({
        where: {
          id: request.params.id,
          workspaceId: workspaceAccess.workspaceId,
          archivedAt: null
        }
      });

      if (!category) {
        await sendError(reply, 404, "CATEGORY_NOT_FOUND", "Category was not found.");
        return;
      }

      const body = request.body ?? {};
      const name = hasOwnProperty(body, "name")
        ? readRequiredString(body.name)
        : category.name;
      if (!name) {
        await sendError(reply, 400, "NAME_REQUIRED", "Category name is required.");
        return;
      }

      const usageCycleDays = hasOwnProperty(body, "usageCycleDays")
        ? readOptionalPositiveInteger(body.usageCycleDays) ?? null
        : category.usageCycleDays;
      const hasNextCheckAt = hasOwnProperty(body, "nextCheckAt");
      const nextCheckAtResult = hasNextCheckAt ? readNullableDate(body.nextCheckAt) : null;
      if (nextCheckAtResult?.invalid) {
        await sendError(reply, 400, "INVALID_NEXT_CHECK_AT", "Next check date is invalid.");
        return;
      }

      const nextCheckAt = hasNextCheckAt
        ? nextCheckAtResult?.value ?? null
        : hasOwnProperty(body, "usageCycleDays")
          ? calculateConfiguredNextCheckAt(new Date(), usageCycleDays)
          : category.nextCheckAt;
      const reminderEnabled = hasOwnProperty(body, "reminderEnabled")
        ? readOptionalBoolean(body.reminderEnabled) ?? category.reminderEnabled
        : category.reminderEnabled;

      const updatedCategory = await prisma.category.update({
        where: {
          id: category.id
        },
        data: {
          name,
          icon: hasOwnProperty(body, "icon")
            ? readOptionalString(body.icon) ?? null
            : category.icon,
          usageCycleDays,
          nextCheckAt,
          reminderEnabled
        }
      });

      const categoryItems = await prisma.item.findMany({
        where: {
          categoryId: category.id,
          workspaceId: workspaceAccess.workspaceId,
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
    const workspaceAccess = await resolveWorkspaceAccess(request, userId);
    if (!workspaceAccess) {
      await sendError(reply, 404, "CATEGORY_NOT_FOUND", "Category was not found.");
      return;
    }
    if (!canWriteWorkspace(workspaceAccess)) {
      await sendError(reply, 403, "WORKSPACE_WRITE_FORBIDDEN", "Workspace write access is required.");
      return;
    }
    const now = new Date();
    const category = await prisma.category.findFirst({
      where: {
        id: request.params.id,
        workspaceId: workspaceAccess.workspaceId,
        archivedAt: null
      }
    });

    if (!category) {
      await sendError(reply, 404, "CATEGORY_NOT_FOUND", "Category was not found.");
      return;
    }

    return prisma.$transaction(async (tx) => {
      const [itemsToArchive, activeItems] = await Promise.all([
        tx.item.findMany({
          where: {
            workspaceId: workspaceAccess.workspaceId,
            categoryId: category.id,
            archivedAt: null
          },
          select: {
            id: true,
            name: true,
            createdAt: true,
            lastBoughtAt: true
          }
        }),
        tx.item.findMany({
          where: {
            workspaceId: workspaceAccess.workspaceId,
            archivedAt: null
          },
          select: {
            id: true,
            name: true
          }
        })
      ]);

      await clearRecommendationDismissalsForItems(
        tx,
        userId,
        workspaceAccess.workspaceId,
        itemsToArchive,
        activeItems
      );

      await tx.item.updateMany({
        where: {
          workspaceId: workspaceAccess.workspaceId,
          categoryId: category.id,
          archivedAt: null
        },
        data: {
          archivedAt: now
        }
      });

      await tx.shoppingListItem.updateMany({
        where: {
          workspaceId: workspaceAccess.workspaceId,
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

  app.post<{ Params: { id: string } }>("/api/categories/:id/restore", async (request, reply) => {
    const userId = requireUserId(request.userId);
    const workspaceAccess = await resolveWorkspaceAccess(request, userId);
    if (!workspaceAccess) {
      await sendError(reply, 404, "CATEGORY_NOT_FOUND", "Archived category was not found.");
      return;
    }
    if (!canWriteWorkspace(workspaceAccess)) {
      await sendError(reply, 403, "WORKSPACE_WRITE_FORBIDDEN", "Workspace write access is required.");
      return;
    }
    const category = await prisma.category.findFirst({
      where: {
        id: request.params.id,
        workspaceId: workspaceAccess.workspaceId,
        archivedAt: {
          not: null
        }
      }
    });

    if (!category || !category.archivedAt) {
      await sendError(reply, 404, "CATEGORY_NOT_FOUND", "Archived category was not found.");
      return;
    }

    return prisma.$transaction(async (tx) => {
      const itemsToRestore = await tx.item.findMany({
        where: {
          workspaceId: workspaceAccess.workspaceId,
          categoryId: category.id,
          archivedAt: category.archivedAt
        }
      });

      await tx.category.update({
        where: {
          id: category.id
        },
        data: {
          archivedAt: null
        }
      });

      await tx.item.updateMany({
        where: {
          workspaceId: workspaceAccess.workspaceId,
          categoryId: category.id,
          archivedAt: category.archivedAt
        },
        data: {
          archivedAt: null
        }
      });

      for (const item of itemsToRestore) {
        await syncRestoredItem(tx, item);
      }

      const categoryItems = await tx.item.findMany({
        where: {
          categoryId: category.id,
          workspaceId: workspaceAccess.workspaceId,
          archivedAt: null
        },
        select: {
          status: true
        }
      });

      return {
        ...category,
        archivedAt: null,
        itemCount: categoryItems.length,
        aggregateStatus: aggregateCategoryStatus(categoryItems)
      };
    });
  });

  app.delete<{ Params: { id: string } }>("/api/categories/:id", async (request, reply) => {
    const userId = requireUserId(request.userId);
    const workspaceAccess = await resolveWorkspaceAccess(request, userId);
    if (!workspaceAccess) {
      await sendError(reply, 404, "CATEGORY_NOT_FOUND", "Category was not found.");
      return;
    }
    if (!canWriteWorkspace(workspaceAccess)) {
      await sendError(reply, 403, "WORKSPACE_WRITE_FORBIDDEN", "Workspace write access is required.");
      return;
    }
    const category = await prisma.category.findFirst({
      where: {
        id: request.params.id,
        workspaceId: workspaceAccess.workspaceId
      }
    });

    if (!category) {
      await sendError(reply, 404, "CATEGORY_NOT_FOUND", "Category was not found.");
      return;
    }

    if (!category.archivedAt) {
      await sendError(
        reply,
        409,
        "CATEGORY_NOT_ARCHIVED",
        "Archive the category before deleting it."
      );
      return;
    }

    await prisma.category.delete({
      where: {
        id: category.id
      }
    });

    return {
      deleted: true
    };
  });
}
