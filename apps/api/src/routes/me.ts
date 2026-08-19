import { prisma } from "@kupitnezabyt/database";
import type { FastifyInstance } from "fastify";

import { checkRateLimit, requireUserId, sendError } from "../lib/helpers.js";
import { sensitiveRateLimiter } from "../lib/rate-limiters.js";

export default async function meRoutes(app: FastifyInstance) {
  app.get("/api/me", async (request) => {
    return prisma.user.findUniqueOrThrow({
      where: {
        id: requireUserId(request.userId)
      }
    });
  });

  app.patch("/api/me/onboarding", async (request) => {
    return prisma.user.update({
      where: {
        id: requireUserId(request.userId)
      },
      data: {
        onboardingCompletedAt: new Date()
      }
    });
  });

  app.delete("/api/me", async (request, reply) => {
    const userId = requireUserId(request.userId);
    if (!(await checkRateLimit(reply, sensitiveRateLimiter, `sensitive:delete-account:${userId}`))) {
      return;
    }

    const ownedSharedWorkspace = await prisma.workspace.findFirst({
      where: {
        ownerId: userId,
        members: {
          some: {
            userId: {
              not: userId
            }
          }
        }
      },
      select: {
        id: true,
        name: true
      }
    });

    if (ownedSharedWorkspace) {
      await sendError(
        reply,
        409,
        "OWNED_SHARED_WORKSPACE_REQUIRES_TRANSFER",
        `Transfer ownership or remove members before deleting "${ownedSharedWorkspace.name}".`
      );
      return;
    }

    await prisma.user.delete({
      where: {
        id: userId
      }
    });

    return {
      deleted: true
    };
  });
}
