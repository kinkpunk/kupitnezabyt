import { prisma } from "@kupitnezabyt/database";
import type { FastifyInstance } from "fastify";

import { markShoppingListItemBought } from "../services.js";
import {
  canWriteWorkspace,
  hasOwnProperty,
  readOptionalString,
  readRequiredString,
  readShoppingPriority,
  requireUserId,
  resolveWorkspaceAccess,
  sendError
} from "../lib/helpers.js";
import type { ShoppingListBody } from "../lib/types.js";

export default async function shoppingListRoutes(app: FastifyInstance) {
  app.get("/api/shopping-list", async (request) => {
    const userId = requireUserId(request.userId);
    const workspaceAccess = await resolveWorkspaceAccess(request, userId);
    if (!workspaceAccess) {
      return [];
    }

    return prisma.shoppingListItem.findMany({
      where: {
        workspaceId: workspaceAccess.workspaceId,
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
    const workspaceAccess = await resolveWorkspaceAccess(request, userId);
    if (!workspaceAccess) {
      await sendError(reply, 404, "WORKSPACE_NOT_FOUND", "Workspace was not found.");
      return;
    }
    if (!canWriteWorkspace(workspaceAccess)) {
      await sendError(reply, 403, "WORKSPACE_WRITE_FORBIDDEN", "Workspace write access is required.");
      return;
    }

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
          workspaceId: workspaceAccess.workspaceId,
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
        workspaceId: workspaceAccess.workspaceId,
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
      const workspaceAccess = await resolveWorkspaceAccess(request, userId);
      if (!workspaceAccess) {
        await sendError(
          reply,
          404,
          "SHOPPING_LIST_ITEM_NOT_FOUND",
          "Shopping list item was not found."
        );
        return;
      }
      if (!canWriteWorkspace(workspaceAccess)) {
        await sendError(reply, 403, "WORKSPACE_WRITE_FORBIDDEN", "Workspace write access is required.");
        return;
      }
      const shoppingListItem = await prisma.shoppingListItem.findFirst({
        where: {
          id: request.params.id,
          workspaceId: workspaceAccess.workspaceId,
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
            workspaceId: workspaceAccess.workspaceId,
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
      const userId = requireUserId(request.userId);
      const workspaceAccess = await resolveWorkspaceAccess(request, userId);
      if (!workspaceAccess) {
        await sendError(
          reply,
          404,
          "SHOPPING_LIST_ITEM_NOT_FOUND",
          "Shopping list item was not found."
        );
        return;
      }
      if (!canWriteWorkspace(workspaceAccess)) {
        await sendError(reply, 403, "WORKSPACE_WRITE_FORBIDDEN", "Workspace write access is required.");
        return;
      }

      try {
        const completedItem = await prisma.$transaction((tx) =>
          markShoppingListItemBought(
            tx,
            userId,
            request.params.id,
            new Date(),
            workspaceAccess.workspaceId
          )
        );
        return prisma.shoppingListItem.findUniqueOrThrow({
          where: {
            id: completedItem.id
          },
          include: {
            category: true,
            item: true
          }
        });
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
    const workspaceAccess = await resolveWorkspaceAccess(request, userId);
    if (!workspaceAccess) {
      await sendError(
        reply,
        404,
        "SHOPPING_LIST_ITEM_NOT_FOUND",
        "Shopping list item was not found."
      );
      return;
    }
    if (!canWriteWorkspace(workspaceAccess)) {
      await sendError(reply, 403, "WORKSPACE_WRITE_FORBIDDEN", "Workspace write access is required.");
      return;
    }
    const shoppingListItem = await prisma.shoppingListItem.findFirst({
      where: {
        id: request.params.id,
        workspaceId: workspaceAccess.workspaceId,
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

  app.delete("/api/shopping-list/completed", async (request, reply) => {
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

    const result = await prisma.shoppingListItem.deleteMany({
      where: {
        workspaceId: workspaceAccess.workspaceId,
        isCompleted: true
      }
    });

    return {
      deletedCount: result.count
    };
  });
}
