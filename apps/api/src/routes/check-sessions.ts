import { prisma } from "@kupitnezabyt/database";
import { isItemStatus } from "@kupitnezabyt/shared";
import type { FastifyInstance } from "fastify";

import { setItemStatus } from "../services.js";
import {
  calculateConfiguredNextCheckAt,
  canWriteWorkspace,
  requireUserId,
  resolveWorkspaceAccess,
  sendError
} from "../lib/helpers.js";
import type { StatusBody } from "../lib/types.js";

const checkSessionInclude = {
  category: true,
  group: true,
  items: {
    include: {
      item: true
    },
    orderBy: {
      sortOrder: "asc"
    }
  }
} as const;

export default async function checkSessionRoutes(app: FastifyInstance) {
  app.get("/api/check/session/active", async (request) => {
    const userId = requireUserId(request.userId);
    const workspaceAccess = await resolveWorkspaceAccess(request, userId);
    if (!workspaceAccess) {
      return null;
    }

    return prisma.checkSession.findFirst({
      where: {
        workspaceId: workspaceAccess.workspaceId,
        status: "IN_PROGRESS"
      },
      include: checkSessionInclude,
      orderBy: {
        startedAt: "desc"
      }
    });
  });

  app.get<{ Params: { sessionId: string } }>(
    "/api/check/session/:sessionId",
    async (request, reply) => {
      const userId = requireUserId(request.userId);
      const workspaceAccess = await resolveWorkspaceAccess(request, userId);
      if (!workspaceAccess) {
        await sendError(reply, 404, "CHECK_SESSION_NOT_FOUND", "Check session was not found.");
        return;
      }

      const session = await prisma.checkSession.findFirst({
        where: {
          id: request.params.sessionId,
          workspaceId: workspaceAccess.workspaceId
        },
        include: checkSessionInclude
      });

      if (!session) {
        await sendError(reply, 404, "CHECK_SESSION_NOT_FOUND", "Check session was not found.");
        return;
      }

      return session;
    }
  );

  app.post<{ Body: StatusBody; Params: { sessionId: string; itemId: string } }>(
    "/api/check/session/:sessionId/item/:itemId/status",
    async (request, reply) => {
      const userId = requireUserId(request.userId);
      const workspaceAccess = await resolveWorkspaceAccess(request, userId);
      if (!workspaceAccess) {
        await sendError(reply, 404, "CHECK_SESSION_NOT_FOUND", "Check session was not found.");
        return;
      }
      if (!canWriteWorkspace(workspaceAccess)) {
        await sendError(reply, 403, "WORKSPACE_WRITE_FORBIDDEN", "Workspace write access is required.");
        return;
      }
      const status = request.body?.status;
      if (typeof status !== "string" || !isItemStatus(status) || status === "PAUSED") {
        await sendError(reply, 400, "INVALID_STATUS", "Item status is invalid for a check.");
        return;
      }

      const session = await prisma.checkSession.findFirst({
        where: {
          id: request.params.sessionId,
          workspaceId: workspaceAccess.workspaceId,
          status: "IN_PROGRESS"
        }
      });

      if (!session) {
        await sendError(reply, 404, "CHECK_SESSION_NOT_FOUND", "Check session was not found.");
        return;
      }

      const sessionItem = await prisma.checkSessionItem.findFirst({
        where: {
          sessionId: session.id,
          itemId: request.params.itemId
        }
      });

      if (!sessionItem) {
        await sendError(reply, 404, "CHECK_SESSION_ITEM_NOT_FOUND", "Check item was not found.");
        return;
      }

      await prisma.$transaction(async (tx) => {
        await setItemStatus(tx, userId, request.params.itemId, status, new Date(), workspaceAccess.workspaceId);
        await tx.checkSessionItem.update({
          where: {
            id: sessionItem.id
          },
          data: {
            selectedStatus: status,
            checkedAt: new Date()
          }
        });
      });

      return prisma.checkSession.findUniqueOrThrow({
        where: {
          id: session.id
        },
        include: checkSessionInclude
      });
    }
  );

  app.post<{ Params: { sessionId: string } }>(
    "/api/check/session/:sessionId/complete",
    async (request, reply) => {
      const userId = requireUserId(request.userId);
      const workspaceAccess = await resolveWorkspaceAccess(request, userId);
      if (!workspaceAccess) {
        await sendError(reply, 404, "CHECK_SESSION_NOT_FOUND", "Check session was not found.");
        return;
      }
      if (!canWriteWorkspace(workspaceAccess)) {
        await sendError(reply, 403, "WORKSPACE_WRITE_FORBIDDEN", "Workspace write access is required.");
        return;
      }

      const session = await prisma.checkSession.findFirst({
        where: {
          id: request.params.sessionId,
          workspaceId: workspaceAccess.workspaceId,
          status: "IN_PROGRESS"
        }
      });

      if (!session) {
        await sendError(reply, 404, "CHECK_SESSION_NOT_FOUND", "Check session was not found.");
        return;
      }

      const now = new Date();
      return prisma.$transaction(async (tx) => {
        const completedSession = await tx.checkSession.update({
          where: {
            id: session.id
          },
          data: {
            status: "COMPLETED",
            completedAt: now
          },
          include: checkSessionInclude
        });

        if (completedSession.category) {
          await tx.category.update({
            where: {
              id: completedSession.category.id
            },
            data: {
              nextCheckAt: calculateConfiguredNextCheckAt(
                now,
                completedSession.category.usageCycleDays
              )
            }
          });
        }

        if (completedSession.group) {
          await tx.itemGroup.update({
            where: {
              id: completedSession.group.id
            },
            data: {
              nextCheckAt: calculateConfiguredNextCheckAt(
                now,
                completedSession.group.usageCycleDays
              )
            }
          });
        }

        return completedSession;
      });
    }
  );

  app.post<{ Params: { sessionId: string } }>(
    "/api/check/session/:sessionId/cancel",
    async (request, reply) => {
      const userId = requireUserId(request.userId);
      const workspaceAccess = await resolveWorkspaceAccess(request, userId);
      if (!workspaceAccess) {
        await sendError(reply, 404, "CHECK_SESSION_NOT_FOUND", "Check session was not found.");
        return;
      }
      if (!canWriteWorkspace(workspaceAccess)) {
        await sendError(reply, 403, "WORKSPACE_WRITE_FORBIDDEN", "Workspace write access is required.");
        return;
      }

      const session = await prisma.checkSession.findFirst({
        where: {
          id: request.params.sessionId,
          workspaceId: workspaceAccess.workspaceId,
          status: "IN_PROGRESS"
        }
      });

      if (!session) {
        await sendError(reply, 404, "CHECK_SESSION_NOT_FOUND", "Check session was not found.");
        return;
      }

      return prisma.checkSession.update({
        where: {
          id: session.id
        },
        data: {
          status: "CANCELLED",
          completedAt: new Date()
        },
        include: checkSessionInclude
      });
    }
  );

  app.post<{ Params: { categoryId: string } }>(
    "/api/check/category/:categoryId/start",
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
          id: request.params.categoryId,
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
          categoryId: category.id,
          archivedAt: null,
          status: {
            not: "PAUSED"
          }
        },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
      });

      if (items.length === 0) {
        await sendError(reply, 400, "EMPTY_CHECK_CATEGORY", "Category has no items to check.");
        return;
      }

      return prisma.checkSession.create({
        data: {
          userId,
          workspaceId: workspaceAccess.workspaceId,
          categoryId: category.id,
          items: {
            create: items.map((item, index) => ({
              itemId: item.id,
              sortOrder: index
            }))
          }
        },
        include: checkSessionInclude
      });
    }
  );

  app.post<{ Params: { groupId: string } }>(
    "/api/check/group/:groupId/start",
    async (request, reply) => {
      const userId = requireUserId(request.userId);
      const workspaceAccess = await resolveWorkspaceAccess(request, userId);
      if (!workspaceAccess) {
        await sendError(reply, 404, "GROUP_NOT_FOUND", "Group was not found.");
        return;
      }
      if (!canWriteWorkspace(workspaceAccess)) {
        await sendError(reply, 403, "WORKSPACE_WRITE_FORBIDDEN", "Workspace write access is required.");
        return;
      }
      const group = await prisma.itemGroup.findFirst({
        where: {
          id: request.params.groupId,
          workspaceId: workspaceAccess.workspaceId,
          archivedAt: null
        },
        include: {
          items: {
            include: {
              item: true
            }
          }
        }
      });

      if (!group) {
        await sendError(reply, 404, "GROUP_NOT_FOUND", "Group was not found.");
        return;
      }

      const activeItems = group.items
        .map((groupItem) => groupItem.item)
        .filter((item) => item.archivedAt === null && item.status !== "PAUSED");

      if (activeItems.length === 0) {
        await sendError(reply, 400, "EMPTY_CHECK_GROUP", "Group has no items to check.");
        return;
      }

      return prisma.checkSession.create({
        data: {
          userId,
          workspaceId: workspaceAccess.workspaceId,
          groupId: group.id,
          items: {
            create: activeItems.map((item, index) => ({
              itemId: item.id,
              sortOrder: index
            }))
          }
        },
        include: checkSessionInclude
      });
    }
  );
}
