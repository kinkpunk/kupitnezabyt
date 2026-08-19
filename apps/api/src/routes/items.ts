import { prisma } from "@kupitnezabyt/database";
import {
  calculateNextCheckAt,
  calculateSnoozedUntil,
  getRuleBasedRecommendations,
  HIDE_SIMILAR_RECOMMENDATION_ITEM,
  isItemStatus,
  normalizeName,
  normalizeSearchQuery,
  parseRecommendationId,
  sortItemsByStatus
} from "@kupitnezabyt/shared";
import type { FastifyInstance } from "fastify";

import {
  cancelPendingItemCheckReminders,
  setItemStatus,
  upsertItemCheckReminder
} from "../services.js";
import {
  calculateConfiguredNextCheckAt,
  canWriteWorkspace,
  hasOwnProperty,
  readNullableDate,
  readOptionalBoolean,
  readOptionalItemImportance,
  readOptionalPositiveInteger,
  readOptionalString,
  readRequiredString,
  readStringArray,
  requireUserId,
  resolveWorkspaceAccess,
  sendError
} from "../lib/helpers.js";
import {
  clearRecommendationDismissalsForItems,
  getRecommendationsForItem
} from "../lib/recommendations.js";
import { syncRestoredItem } from "../lib/restore.js";
import type {
  AcceptRecommendationBody,
  ArchivedQuery,
  CreateItemBody,
  ReorderItemsBody,
  SnoozeBody,
  StatusBody,
  UpdateItemBody
} from "../lib/types.js";

export default async function itemRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { categoryId?: string; sort?: string } & ArchivedQuery }>(
    "/api/items",
    async (request) => {
      const userId = requireUserId(request.userId);
      const workspaceAccess = await resolveWorkspaceAccess(request, userId);
      if (!workspaceAccess) {
        return [];
      }
      const categoryId = readOptionalString(request.query.categoryId);
      const archived = request.query.archived === "true" || request.query.archived === "1";
      const sort = readOptionalString(request.query.sort);

      const items = await prisma.item.findMany({
        where: {
          workspaceId: workspaceAccess.workspaceId,
          ...(categoryId ? { categoryId } : {}),
          archivedAt: archived ? { not: null } : null
        },
        include: {
          category: true
        },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
      });

      if (sort === "status") {
        return sortItemsByStatus(items);
      }

      return items;
    }
  );

  app.get<{ Querystring: { q?: string } }>("/api/items/search", async (request, reply) => {
    const userId = requireUserId(request.userId);
    const workspaceAccess = await resolveWorkspaceAccess(request, userId);
    if (!workspaceAccess) {
      return [];
    }
    const query = normalizeSearchQuery(request.query.q ?? "");
    if (!query) {
      await sendError(reply, 400, "SEARCH_QUERY_REQUIRED", "Search query is required.");
      return;
    }

    return prisma.item.findMany({
      where: {
        workspaceId: workspaceAccess.workspaceId,
        archivedAt: null,
        OR: [
          {
            name: {
              contains: query,
              mode: "insensitive"
            }
          },
          {
            brand: {
              contains: query,
              mode: "insensitive"
            }
          },
          {
            notes: {
              contains: query,
              mode: "insensitive"
            }
          },
          {
            category: {
              name: {
                contains: query,
                mode: "insensitive"
              }
            }
          }
        ]
      },
      include: {
        category: true
      },
      orderBy: {
        updatedAt: "desc"
      },
      take: 50
    });
  });

  app.post<{ Body: CreateItemBody }>("/api/items", async (request, reply) => {
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
        workspaceId: workspaceAccess.workspaceId,
        archivedAt: null
      }
    });

    if (!category) {
      await sendError(reply, 404, "CATEGORY_NOT_FOUND", "Category was not found.");
      return;
    }

    const usageCycleDays = readOptionalPositiveInteger(request.body?.usageCycleDays) ?? null;
    const importance = readOptionalItemImportance(request.body?.importance);
    if (importance === null) {
      await sendError(reply, 400, "INVALID_IMPORTANCE", "Item importance is invalid.");
      return;
    }

    const initialStatus = usageCycleDays ? "IN_STOCK" : "NEED_BUY";
    const now = new Date();

    return prisma.$transaction(async (tx) => {
      const maxSortOrder = await tx.item.aggregate({
        where: {
          workspaceId: workspaceAccess.workspaceId,
          categoryId,
          archivedAt: null
        },
        _max: {
          sortOrder: true
        }
      });
      const nextSortOrder = (maxSortOrder._max.sortOrder ?? -1) + 1;

      const item = await tx.item.create({
        data: {
          userId,
          workspaceId: workspaceAccess.workspaceId,
          categoryId,
          name,
          status: initialStatus,
          brand: readOptionalString(request.body?.brand) ?? null,
          notes: readOptionalString(request.body?.notes) ?? null,
          importance: importance ?? "NORMAL",
          usageCycleDays,
          sortOrder: nextSortOrder,
          nextCheckAt: calculateNextCheckAt(initialStatus, now, usageCycleDays)
        }
      });

      if (initialStatus === "NEED_BUY") {
        await tx.shoppingListItem.create({
          data: {
            userId,
            workspaceId: workspaceAccess.workspaceId,
            itemId: item.id,
            title: item.name,
            categoryId: item.categoryId,
            priority: "NORMAL"
          }
        });
      }

      if (item.nextCheckAt) {
        await upsertItemCheckReminder(tx, {
          userId,
          workspaceId: workspaceAccess.workspaceId,
          itemId: item.id,
          scheduledFor: item.nextCheckAt
        });
      }

      return item;
    });
  });

  app.post<{ Body: ReorderItemsBody }>("/api/items/reorder", async (request, reply) => {
    const categoryId = readRequiredString(request.body?.categoryId);
    if (!categoryId) {
      await sendError(reply, 400, "CATEGORY_ID_REQUIRED", "Category id is required.");
      return;
    }

    const itemIds = readStringArray(request.body?.itemIds);
    if (!itemIds || itemIds.length === 0) {
      await sendError(reply, 400, "ITEM_IDS_REQUIRED", "Item ids are required.");
      return;
    }

    if (new Set(itemIds).size !== itemIds.length) {
      await sendError(reply, 400, "DUPLICATE_ITEM_IDS", "Item ids must be unique.");
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

    const category = await prisma.category.findFirst({
      where: {
        id: categoryId,
        workspaceId: workspaceAccess.workspaceId,
        archivedAt: null
      }
    });
    if (!category) {
      await sendError(reply, 404, "CATEGORY_NOT_FOUND", "Category was not found.");
      return;
    }

    const items = await prisma.item.findMany({
      where: {
        workspaceId: workspaceAccess.workspaceId,
        categoryId,
        archivedAt: null
      },
      select: {
        id: true
      }
    });
    const ownedItemIds = new Set(items.map((item) => item.id));

    if (itemIds.some((itemId) => !ownedItemIds.has(itemId))) {
      await sendError(reply, 404, "ITEM_NOT_FOUND", "Item was not found.");
      return;
    }

    if (items.length !== itemIds.length) {
      await sendError(
        reply,
        400,
        "ITEM_ORDER_INCOMPLETE",
        "Item ids must include every active item in the category."
      );
      return;
    }

    await prisma.$transaction((tx) =>
      Promise.all(
        itemIds.map((itemId, index) =>
          tx.item.update({
            where: {
              id: itemId
            },
            data: {
              sortOrder: index
            }
          })
        )
      )
    );

    return prisma.item.findMany({
      where: {
        workspaceId: workspaceAccess.workspaceId,
        categoryId,
        archivedAt: null
      },
      include: {
        category: true
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
    });
  });

  app.get<{ Querystring: { itemId?: string } }>("/api/recommendations", async (request, reply) => {
    const userId = requireUserId(request.userId);
    const workspaceAccess = await resolveWorkspaceAccess(request, userId);
    if (!workspaceAccess) {
      await sendError(reply, 404, "ITEM_NOT_FOUND", "Item was not found.");
      return;
    }
    const itemId = readRequiredString(request.query.itemId);
    if (!itemId) {
      await sendError(reply, 400, "ITEM_ID_REQUIRED", "Item id is required.");
      return;
    }

    const triggerItem = await prisma.item.findFirst({
      where: {
        id: itemId,
        workspaceId: workspaceAccess.workspaceId,
        archivedAt: null
      }
    });

    if (!triggerItem) {
      await sendError(reply, 404, "ITEM_NOT_FOUND", "Item was not found.");
      return;
    }

    return getRecommendationsForItem(userId, workspaceAccess.workspaceId, triggerItem);
  });

  app.post<{ Body: AcceptRecommendationBody; Params: { id: string } }>(
    "/api/recommendations/:id/accept",
    async (request, reply) => {
      const userId = requireUserId(request.userId);
      const workspaceAccess = await resolveWorkspaceAccess(request, userId);
      if (!workspaceAccess) {
        await sendError(reply, 404, "ITEM_NOT_FOUND", "Item was not found.");
        return;
      }
      if (!canWriteWorkspace(workspaceAccess)) {
        await sendError(reply, 403, "WORKSPACE_WRITE_FORBIDDEN", "Workspace write access is required.");
        return;
      }
      const recommendationId = parseRecommendationId(request.params.id);
      if (!recommendationId) {
        await sendError(reply, 400, "INVALID_RECOMMENDATION", "Recommendation id is invalid.");
        return;
      }

      const triggerItem = await prisma.item.findFirst({
        where: {
          id: recommendationId.itemId,
          workspaceId: workspaceAccess.workspaceId,
          archivedAt: null
        }
      });

      if (!triggerItem) {
        await sendError(reply, 404, "ITEM_NOT_FOUND", "Item was not found.");
        return;
      }

      const activeItems = await prisma.item.findMany({
        where: {
          workspaceId: workspaceAccess.workspaceId,
          archivedAt: null
        }
      });
      const normalizedSuggestedItem = normalizeName(recommendationId.suggestedItem);
      const duplicateItem = activeItems.find(
        (item) => normalizeName(item.name) === normalizedSuggestedItem
      );
      if (duplicateItem) {
        return duplicateItem;
      }

      const suggestion = getRuleBasedRecommendations({
        triggerItem,
        userItems: activeItems,
        dismissals: [],
        limit: 20
      }).find(
        (currentSuggestion) =>
          currentSuggestion.ruleId === recommendationId.ruleId &&
          normalizeName(currentSuggestion.suggestedItem) === normalizedSuggestedItem
      );

      if (!suggestion) {
        await sendError(reply, 404, "RECOMMENDATION_NOT_FOUND", "Recommendation was not found.");
        return;
      }

      const categoryId = readOptionalString(request.body?.categoryId) ?? triggerItem.categoryId;
      const category = await prisma.category.findFirst({
        where: {
          id: categoryId,
          workspaceId: workspaceAccess.workspaceId,
          archivedAt: null
        }
      });

      if (!category) {
        await sendError(reply, 404, "CATEGORY_NOT_FOUND", "Category was not found.");
        return;
      }

      return prisma.$transaction(async (tx) => {
        const item = await tx.item.create({
          data: {
            userId,
            workspaceId: workspaceAccess.workspaceId,
            categoryId: category.id,
            name: suggestion.suggestedItem,
            status: "NEED_BUY"
          }
        });

        await tx.shoppingListItem.create({
          data: {
            userId,
            workspaceId: workspaceAccess.workspaceId,
            itemId: item.id,
            title: item.name,
            categoryId: item.categoryId,
            priority: "NORMAL"
          }
        });

        return item;
      });
    }
  );

  app.post<{ Params: { id: string } }>("/api/recommendations/:id/dismiss", async (request, reply) => {
    const userId = requireUserId(request.userId);
    const workspaceAccess = await resolveWorkspaceAccess(request, userId);
    if (!workspaceAccess) {
      await sendError(reply, 404, "ITEM_NOT_FOUND", "Item was not found.");
      return;
    }
    if (!canWriteWorkspace(workspaceAccess)) {
      await sendError(reply, 403, "WORKSPACE_WRITE_FORBIDDEN", "Workspace write access is required.");
      return;
    }
    const recommendationId = parseRecommendationId(request.params.id);
    if (!recommendationId) {
      await sendError(reply, 400, "INVALID_RECOMMENDATION", "Recommendation id is invalid.");
      return;
    }

    const triggerItem = await prisma.item.findFirst({
      where: {
        id: recommendationId.itemId,
        workspaceId: workspaceAccess.workspaceId,
        archivedAt: null
      }
    });

    if (!triggerItem) {
      await sendError(reply, 404, "ITEM_NOT_FOUND", "Item was not found.");
      return;
    }

    const suggestion = (await getRecommendationsForItem(userId, workspaceAccess.workspaceId, triggerItem)).find(
      (currentSuggestion) =>
        currentSuggestion.ruleId === recommendationId.ruleId &&
        normalizeName(currentSuggestion.suggestedItem) ===
          normalizeName(recommendationId.suggestedItem)
    );

    if (!suggestion) {
      await sendError(reply, 404, "RECOMMENDATION_NOT_FOUND", "Recommendation was not found.");
      return;
    }

    await prisma.recommendationDismissal.upsert({
      where: {
        userId_ruleId_suggestedItem: {
          userId,
          ruleId: recommendationId.ruleId,
          suggestedItem: suggestion.suggestedItem
        }
      },
      update: {},
      create: {
        userId,
        workspaceId: workspaceAccess.workspaceId,
        ruleId: recommendationId.ruleId,
        suggestedItem: suggestion.suggestedItem
      }
    });

    return {
      dismissed: true
    };
  });

  app.post<{ Params: { id: string } }>(
    "/api/recommendations/:id/hide-similar",
    async (request, reply) => {
      const userId = requireUserId(request.userId);
      const workspaceAccess = await resolveWorkspaceAccess(request, userId);
      if (!workspaceAccess) {
        await sendError(reply, 404, "ITEM_NOT_FOUND", "Item was not found.");
        return;
      }
      if (!canWriteWorkspace(workspaceAccess)) {
        await sendError(reply, 403, "WORKSPACE_WRITE_FORBIDDEN", "Workspace write access is required.");
        return;
      }
      const recommendationId = parseRecommendationId(request.params.id);
      if (!recommendationId) {
        await sendError(reply, 400, "INVALID_RECOMMENDATION", "Recommendation id is invalid.");
        return;
      }

      const triggerItem = await prisma.item.findFirst({
        where: {
          id: recommendationId.itemId,
          workspaceId: workspaceAccess.workspaceId,
          archivedAt: null
        }
      });

      if (!triggerItem) {
        await sendError(reply, 404, "ITEM_NOT_FOUND", "Item was not found.");
        return;
      }

      const suggestion = (await getRecommendationsForItem(userId, workspaceAccess.workspaceId, triggerItem)).find(
        (currentSuggestion) =>
          currentSuggestion.ruleId === recommendationId.ruleId &&
          normalizeName(currentSuggestion.suggestedItem) ===
            normalizeName(recommendationId.suggestedItem)
      );

      if (!suggestion) {
        await sendError(reply, 404, "RECOMMENDATION_NOT_FOUND", "Recommendation was not found.");
        return;
      }

      await prisma.recommendationDismissal.upsert({
        where: {
          userId_ruleId_suggestedItem: {
            userId,
            ruleId: recommendationId.ruleId,
            suggestedItem: HIDE_SIMILAR_RECOMMENDATION_ITEM
          }
        },
        update: {},
        create: {
          userId,
          workspaceId: workspaceAccess.workspaceId,
          ruleId: recommendationId.ruleId,
          suggestedItem: HIDE_SIMILAR_RECOMMENDATION_ITEM
        }
      });

      return {
        hidden: true,
        ruleId: recommendationId.ruleId
      };
    }
  );

  app.get<{ Params: { id: string } }>("/api/items/:id", async (request, reply) => {
    const userId = requireUserId(request.userId);
    const workspaceAccess = await resolveWorkspaceAccess(request, userId);
    if (!workspaceAccess) {
      await sendError(reply, 404, "ITEM_NOT_FOUND", "Item was not found.");
      return;
    }

    const item = await prisma.item.findFirst({
      where: {
        id: request.params.id,
        workspaceId: workspaceAccess.workspaceId,
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
      const workspaceAccess = await resolveWorkspaceAccess(request, userId);
      if (!workspaceAccess) {
        await sendError(reply, 404, "ITEM_NOT_FOUND", "Item was not found.");
        return;
      }
      if (!canWriteWorkspace(workspaceAccess)) {
        await sendError(reply, 403, "WORKSPACE_WRITE_FORBIDDEN", "Workspace write access is required.");
        return;
      }

      const item = await prisma.item.findFirst({
        where: {
          id: request.params.id,
          workspaceId: workspaceAccess.workspaceId,
          archivedAt: null
        }
      });

      if (!item) {
        await sendError(reply, 404, "ITEM_NOT_FOUND", "Item was not found.");
        return;
      }

      const body = request.body ?? {};
      const name = hasOwnProperty(body, "name") ? readRequiredString(body.name) : item.name;
      if (!name) {
        await sendError(reply, 400, "NAME_REQUIRED", "Item name is required.");
        return;
      }

      const categoryId = hasOwnProperty(body, "categoryId")
        ? readOptionalString(body.categoryId)
        : undefined;
      if (categoryId) {
        const category = await prisma.category.findFirst({
          where: {
            id: categoryId,
            workspaceId: workspaceAccess.workspaceId,
            archivedAt: null
          }
        });

        if (!category) {
          await sendError(reply, 404, "CATEGORY_NOT_FOUND", "Category was not found.");
          return;
        }
      }

      const nextCategoryId = categoryId ?? item.categoryId;
      const isCategoryChanged = nextCategoryId !== item.categoryId;
      const usageCycleDays = hasOwnProperty(body, "usageCycleDays")
        ? readOptionalPositiveInteger(body.usageCycleDays) ?? null
        : item.usageCycleDays;
      const brand = hasOwnProperty(body, "brand")
        ? readOptionalString(body.brand) ?? null
        : item.brand;
      const notes = hasOwnProperty(body, "notes")
        ? readOptionalString(body.notes) ?? null
        : item.notes;
      let importance = item.importance;
      if (hasOwnProperty(body, "importance")) {
        const parsedImportance = readOptionalItemImportance(body.importance);
        if (!parsedImportance) {
          await sendError(reply, 400, "INVALID_IMPORTANCE", "Item importance is invalid.");
          return;
        }
        importance = parsedImportance;
      }
      const hasNextCheckAt = hasOwnProperty(body, "nextCheckAt");
      const nextCheckAtResult = hasNextCheckAt ? readNullableDate(body.nextCheckAt) : null;
      if (nextCheckAtResult?.invalid) {
        await sendError(reply, 400, "INVALID_NEXT_CHECK_AT", "Next check date is invalid.");
        return;
      }

      const reminderEnabled = hasOwnProperty(body, "reminderEnabled")
        ? readOptionalBoolean(body.reminderEnabled) ?? item.reminderEnabled
        : item.reminderEnabled;
      const now = new Date();
      const nextCheckAt = hasNextCheckAt
        ? nextCheckAtResult?.value ?? null
        : hasOwnProperty(body, "usageCycleDays")
          ? item.status === "PAUSED"
            ? null
            : calculateConfiguredNextCheckAt(now, usageCycleDays)
          : item.nextCheckAt;
      return prisma.$transaction(async (tx) => {
        let nextSortOrder = item.sortOrder;
        if (isCategoryChanged) {
          const maxSortOrder = await tx.item.aggregate({
            where: {
              workspaceId: workspaceAccess.workspaceId,
              categoryId: nextCategoryId,
              archivedAt: null
            },
            _max: {
              sortOrder: true
            }
          });
          nextSortOrder = (maxSortOrder._max.sortOrder ?? -1) + 1;
        }

        const updatedItem = await tx.item.update({
          where: {
            id: item.id
          },
          data: {
            name,
            categoryId: nextCategoryId,
            brand,
            notes,
            importance,
            usageCycleDays,
            sortOrder: nextSortOrder,
            nextCheckAt,
            reminderEnabled
          }
        });

        await tx.shoppingListItem.updateMany({
          where: {
            workspaceId: workspaceAccess.workspaceId,
            itemId: item.id,
            isCompleted: false
          },
          data: {
            title: updatedItem.name,
            categoryId: nextCategoryId
          }
        });

        if (updatedItem.nextCheckAt && updatedItem.reminderEnabled && updatedItem.status !== "PAUSED") {
          await upsertItemCheckReminder(tx, {
            userId,
            workspaceId: workspaceAccess.workspaceId,
            itemId: updatedItem.id,
            scheduledFor: updatedItem.nextCheckAt
          });
        } else {
          await cancelPendingItemCheckReminders(tx, userId, updatedItem.id);
        }

        return updatedItem;
      });
    }
  );

  app.post<{ Body: StatusBody; Params: { id: string } }>(
    "/api/items/:id/status",
    async (request, reply) => {
      const userId = requireUserId(request.userId);
      const workspaceAccess = await resolveWorkspaceAccess(request, userId);
      if (!workspaceAccess) {
        await sendError(reply, 404, "ITEM_NOT_FOUND", "Item was not found.");
        return;
      }
      if (!canWriteWorkspace(workspaceAccess)) {
        await sendError(reply, 403, "WORKSPACE_WRITE_FORBIDDEN", "Workspace write access is required.");
        return;
      }

      const status = request.body?.status;
      if (typeof status !== "string" || !isItemStatus(status)) {
        await sendError(reply, 400, "INVALID_STATUS", "Item status is invalid.");
        return;
      }

      try {
        return await prisma.$transaction((tx) =>
          setItemStatus(tx, userId, request.params.id, status, new Date(), workspaceAccess.workspaceId)
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
      const workspaceAccess = await resolveWorkspaceAccess(request, userId);
      if (!workspaceAccess) {
        await sendError(reply, 404, "ITEM_NOT_FOUND", "Item was not found.");
        return;
      }
      if (!canWriteWorkspace(workspaceAccess)) {
        await sendError(reply, 403, "WORKSPACE_WRITE_FORBIDDEN", "Workspace write access is required.");
        return;
      }
      const days = readOptionalPositiveInteger(request.body?.days);
      if (!days) {
        await sendError(reply, 400, "SNOOZE_DAYS_REQUIRED", "Positive snooze days are required.");
        return;
      }

      const item = await prisma.item.findFirst({
        where: {
          id: request.params.id,
          workspaceId: workspaceAccess.workspaceId,
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
          workspaceId: workspaceAccess.workspaceId,
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
    const workspaceAccess = await resolveWorkspaceAccess(request, userId);
    if (!workspaceAccess) {
      await sendError(reply, 404, "ITEM_NOT_FOUND", "Item was not found.");
      return;
    }
    if (!canWriteWorkspace(workspaceAccess)) {
      await sendError(reply, 403, "WORKSPACE_WRITE_FORBIDDEN", "Workspace write access is required.");
      return;
    }
    const now = new Date();
    const item = await prisma.item.findFirst({
      where: {
        id: request.params.id,
        workspaceId: workspaceAccess.workspaceId,
        archivedAt: null
      }
    });

    if (!item) {
      await sendError(reply, 404, "ITEM_NOT_FOUND", "Item was not found.");
      return;
    }

    return prisma.$transaction(async (tx) => {
      const activeItems = await tx.item.findMany({
        where: {
          workspaceId: workspaceAccess.workspaceId,
          archivedAt: null
        },
        select: {
          id: true,
          name: true
        }
      });

      await clearRecommendationDismissalsForItems(
        tx,
        userId,
        workspaceAccess.workspaceId,
        [item],
        activeItems
      );

      await tx.shoppingListItem.updateMany({
        where: {
          workspaceId: workspaceAccess.workspaceId,
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

  app.post<{ Params: { id: string } }>("/api/items/:id/restore", async (request, reply) => {
    const userId = requireUserId(request.userId);
    const workspaceAccess = await resolveWorkspaceAccess(request, userId);
    if (!workspaceAccess) {
      await sendError(reply, 404, "ITEM_NOT_FOUND", "Archived item was not found.");
      return;
    }
    if (!canWriteWorkspace(workspaceAccess)) {
      await sendError(reply, 403, "WORKSPACE_WRITE_FORBIDDEN", "Workspace write access is required.");
      return;
    }
    const item = await prisma.item.findFirst({
      where: {
        id: request.params.id,
        workspaceId: workspaceAccess.workspaceId,
        archivedAt: {
          not: null
        }
      },
      include: {
        category: true
      }
    });

    if (!item) {
      await sendError(reply, 404, "ITEM_NOT_FOUND", "Archived item was not found.");
      return;
    }

    if (item.category.archivedAt) {
      await sendError(
        reply,
        409,
        "CATEGORY_ARCHIVED",
        "Restore the category before restoring this item."
      );
      return;
    }

    return prisma.$transaction(async (tx) => {
      const updatedItem = await tx.item.update({
        where: {
          id: item.id
        },
        data: {
          archivedAt: null
        },
        include: {
          category: true
        }
      });

      await syncRestoredItem(tx, updatedItem);
      return updatedItem;
    });
  });

  app.delete<{ Params: { id: string } }>("/api/items/:id", async (request, reply) => {
    const userId = requireUserId(request.userId);
    const workspaceAccess = await resolveWorkspaceAccess(request, userId);
    if (!workspaceAccess) {
      await sendError(reply, 404, "ITEM_NOT_FOUND", "Item was not found.");
      return;
    }
    if (!canWriteWorkspace(workspaceAccess)) {
      await sendError(reply, 403, "WORKSPACE_WRITE_FORBIDDEN", "Workspace write access is required.");
      return;
    }
    const item = await prisma.item.findFirst({
      where: {
        id: request.params.id,
        workspaceId: workspaceAccess.workspaceId
      }
    });

    if (!item) {
      await sendError(reply, 404, "ITEM_NOT_FOUND", "Item was not found.");
      return;
    }

    if (!item.archivedAt) {
      await sendError(reply, 409, "ITEM_NOT_ARCHIVED", "Archive the item before deleting it.");
      return;
    }

    await prisma.item.delete({
      where: {
        id: item.id
      }
    });

    return {
      deleted: true
    };
  });
}
