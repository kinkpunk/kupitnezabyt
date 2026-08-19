import { prisma } from "@kupitnezabyt/database";
import { getInAppReminders } from "@kupitnezabyt/shared";
import type { FastifyInstance } from "fastify";

import {
  readOptionalPositiveInteger,
  requireUserId,
  resolveWorkspaceAccess
} from "../lib/helpers.js";
import type { RemindersQuery } from "../lib/types.js";

export default async function reminderRoutes(app: FastifyInstance) {
  app.get<{ Querystring: RemindersQuery }>("/api/reminders/in-app", async (request) => {
    const userId = requireUserId(request.userId);
    const workspaceAccess = await resolveWorkspaceAccess(request, userId);
    if (!workspaceAccess) {
      return [];
    }
    const now = new Date();
    const upcomingWindowDays = readOptionalPositiveInteger(request.query.days) ?? 7;
    const [categories, groups, items] = await Promise.all([
      prisma.category.findMany({
        where: {
          workspaceId: workspaceAccess.workspaceId,
          archivedAt: null
        },
        select: {
          id: true,
          name: true,
          nextCheckAt: true,
          reminderEnabled: true,
          archivedAt: true
        }
      }),
      prisma.itemGroup.findMany({
        where: {
          workspaceId: workspaceAccess.workspaceId,
          archivedAt: null
        },
        select: {
          id: true,
          name: true,
          nextCheckAt: true,
          reminderEnabled: true,
          archivedAt: true
        }
      }),
      prisma.item.findMany({
        where: {
          workspaceId: workspaceAccess.workspaceId,
          archivedAt: null
        },
        select: {
          id: true,
          name: true,
          status: true,
          nextCheckAt: true,
          reminderEnabled: true,
          archivedAt: true
        }
      })
    ]);

    return getInAppReminders(
      [
        ...categories.map((category) => ({
          id: category.id,
          entityType: "CATEGORY" as const,
          title: category.name,
          nextCheckAt: category.nextCheckAt,
          reminderEnabled: category.reminderEnabled,
          archivedAt: category.archivedAt
        })),
        ...groups.map((group) => ({
          id: group.id,
          entityType: "GROUP" as const,
          title: group.name,
          nextCheckAt: group.nextCheckAt,
          reminderEnabled: group.reminderEnabled,
          archivedAt: group.archivedAt
        })),
        ...items.map((item) => ({
          id: item.id,
          entityType: "ITEM" as const,
          title: item.name,
          nextCheckAt: item.nextCheckAt,
          reminderEnabled: item.reminderEnabled,
          archivedAt: item.archivedAt,
          status: item.status
        }))
      ],
      now,
      upcomingWindowDays
    ).map((reminder) => ({
      id: `${reminder.entityType}:${reminder.id}`,
      entityId: reminder.id,
      entityType: reminder.entityType,
      title: reminder.title,
      nextCheckAt: reminder.nextCheckAt,
      timing: reminder.timing
    }));
  });
}
