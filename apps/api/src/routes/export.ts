import { prisma } from "@kupitnezabyt/database";
import { createUserDataExport } from "@kupitnezabyt/shared";
import type { FastifyInstance } from "fastify";

import { checkRateLimit, requireUserId } from "../lib/helpers.js";
import { sensitiveRateLimiter } from "../lib/rate-limiters.js";

export default async function exportRoutes(app: FastifyInstance) {
  app.get("/api/export/json", async (request, reply) => {
    const userId = requireUserId(request.userId);
    if (!(await checkRateLimit(reply, sensitiveRateLimiter, `sensitive:export:${userId}`))) {
      return;
    }

    const [
      user,
      categories,
      items,
      shoppingListItems,
      reminders,
      groups,
      checkSessions,
      recommendationDismissals,
      workspaceMemberships,
      ownedWorkspaces
    ] = await Promise.all([
      prisma.user.findUniqueOrThrow({
        where: {
          id: userId
        }
      }),
      prisma.category.findMany({
        where: {
          userId
        },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
      }),
      prisma.item.findMany({
        where: {
          userId
        },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
      }),
      prisma.shoppingListItem.findMany({
        where: {
          userId
        },
        orderBy: {
          createdAt: "asc"
        }
      }),
      prisma.reminder.findMany({
        where: {
          userId
        },
        orderBy: {
          createdAt: "asc"
        }
      }),
      prisma.itemGroup.findMany({
        where: {
          userId
        },
        include: {
          items: {
            orderBy: {
              createdAt: "asc"
            }
          }
        },
        orderBy: {
          createdAt: "asc"
        }
      }),
      prisma.checkSession.findMany({
        where: {
          userId
        },
        include: {
          items: {
            orderBy: {
              sortOrder: "asc"
            }
          }
        },
        orderBy: {
          startedAt: "asc"
        }
      }),
      prisma.recommendationDismissal.findMany({
        where: {
          userId
        },
        orderBy: {
          createdAt: "asc"
        }
      }),
      prisma.workspaceMember.findMany({
        where: {
          userId
        },
        select: {
          id: true,
          workspaceId: true,
          role: true,
          invitedEmail: true,
          invitedAt: true,
          joinedAt: true,
          createdAt: true,
          updatedAt: true
        },
        orderBy: {
          createdAt: "asc"
        }
      }),
      prisma.workspace.findMany({
        where: {
          ownerId: userId
        },
        select: {
          id: true,
          name: true,
          ownerId: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              members: true
            }
          }
        },
        orderBy: {
          createdAt: "asc"
        }
      })
    ]);

    return createUserDataExport({
      exportedAt: new Date(),
      data: {
        user,
        categories,
        items,
        shoppingListItems,
        reminders,
        groups,
        checkSessions,
        recommendationDismissals,
        workspaceMemberships,
        ownedWorkspaces
      }
    });
  });
}
