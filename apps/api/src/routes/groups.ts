import { prisma } from "@kupitnezabyt/database";
import type { FastifyInstance } from "fastify";

import {
  calculateConfiguredNextCheckAt,
  canWriteWorkspace,
  hasOwnProperty,
  readNullableDate,
  readOptionalBoolean,
  readOptionalPositiveInteger,
  readOptionalString,
  readRequiredString,
  requireUserId,
  resolveWorkspaceAccess,
  sendError
} from "../lib/helpers.js";
import type { CheckSettingsBody, GroupItemBody, NamedBody } from "../lib/types.js";

const groupInclude = {
  items: {
    include: {
      item: true
    },
    orderBy: {
      createdAt: "asc"
    }
  }
} as const;

export default async function groupRoutes(app: FastifyInstance) {
  app.get("/api/groups", async (request) => {
    const userId = requireUserId(request.userId);
    const workspaceAccess = await resolveWorkspaceAccess(request, userId);
    if (!workspaceAccess) {
      return [];
    }

    return prisma.itemGroup.findMany({
      where: {
        workspaceId: workspaceAccess.workspaceId,
        archivedAt: null
      },
      include: groupInclude,
      orderBy: {
        createdAt: "asc"
      }
    });
  });

  app.post<{ Body: NamedBody }>("/api/groups", async (request, reply) => {
    const name = readRequiredString(request.body?.name);
    if (!name) {
      await sendError(reply, 400, "NAME_REQUIRED", "Group name is required.");
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
    return prisma.itemGroup.create({
      data: {
        userId,
        workspaceId: workspaceAccess.workspaceId,
        name,
        icon: readOptionalString(request.body?.icon) ?? null
      },
      include: groupInclude
    });
  });

  app.get<{ Params: { id: string } }>("/api/groups/:id", async (request, reply) => {
    const userId = requireUserId(request.userId);
    const workspaceAccess = await resolveWorkspaceAccess(request, userId);
    if (!workspaceAccess) {
      await sendError(reply, 404, "GROUP_NOT_FOUND", "Group was not found.");
      return;
    }

    const group = await prisma.itemGroup.findFirst({
      where: {
        id: request.params.id,
        workspaceId: workspaceAccess.workspaceId,
        archivedAt: null
      },
      include: groupInclude
    });

    if (!group) {
      await sendError(reply, 404, "GROUP_NOT_FOUND", "Group was not found.");
      return;
    }

    return group;
  });

  app.patch<{ Body: CheckSettingsBody; Params: { id: string } }>(
    "/api/groups/:id",
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
          id: request.params.id,
          workspaceId: workspaceAccess.workspaceId,
          archivedAt: null
        }
      });

      if (!group) {
        await sendError(reply, 404, "GROUP_NOT_FOUND", "Group was not found.");
        return;
      }

      const body = request.body ?? {};
      const name = hasOwnProperty(body, "name") ? readRequiredString(body.name) : group.name;
      if (!name) {
        await sendError(reply, 400, "NAME_REQUIRED", "Group name is required.");
        return;
      }

      const usageCycleDays = hasOwnProperty(body, "usageCycleDays")
        ? readOptionalPositiveInteger(body.usageCycleDays) ?? null
        : group.usageCycleDays;
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
          : group.nextCheckAt;
      const reminderEnabled = hasOwnProperty(body, "reminderEnabled")
        ? readOptionalBoolean(body.reminderEnabled) ?? group.reminderEnabled
        : group.reminderEnabled;

      return prisma.itemGroup.update({
        where: {
          id: group.id
        },
        data: {
          name,
          icon: hasOwnProperty(body, "icon") ? readOptionalString(body.icon) ?? null : group.icon,
          usageCycleDays,
          nextCheckAt,
          reminderEnabled
        },
        include: groupInclude
      });
    }
  );

  app.post<{ Params: { id: string } }>("/api/groups/:id/archive", async (request, reply) => {
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
        id: request.params.id,
        workspaceId: workspaceAccess.workspaceId,
        archivedAt: null
      }
    });

    if (!group) {
      await sendError(reply, 404, "GROUP_NOT_FOUND", "Group was not found.");
      return;
    }

    return prisma.itemGroup.update({
      where: {
        id: group.id
      },
      data: {
        archivedAt: new Date()
      },
      include: groupInclude
    });
  });

  app.post<{ Body: GroupItemBody; Params: { id: string } }>(
    "/api/groups/:id/items",
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
      const itemId = readRequiredString(request.body?.itemId);
      if (!itemId) {
        await sendError(reply, 400, "ITEM_ID_REQUIRED", "Item id is required.");
        return;
      }

      const group = await prisma.itemGroup.findFirst({
        where: {
          id: request.params.id,
          workspaceId: workspaceAccess.workspaceId,
          archivedAt: null
        }
      });

      if (!group) {
        await sendError(reply, 404, "GROUP_NOT_FOUND", "Group was not found.");
        return;
      }

      const item = await prisma.item.findFirst({
        where: {
          id: itemId,
          workspaceId: workspaceAccess.workspaceId,
          archivedAt: null
        }
      });

      if (!item) {
        await sendError(reply, 404, "ITEM_NOT_FOUND", "Item was not found.");
        return;
      }

      await prisma.itemGroupItem.upsert({
        where: {
          groupId_itemId: {
            groupId: group.id,
            itemId: item.id
          }
        },
        update: {},
        create: {
          groupId: group.id,
          itemId: item.id
        }
      });

      return prisma.itemGroup.findUniqueOrThrow({
        where: {
          id: group.id
        },
        include: groupInclude
      });
    }
  );

  app.delete<{ Params: { id: string; itemId: string } }>(
    "/api/groups/:id/items/:itemId",
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
          id: request.params.id,
          workspaceId: workspaceAccess.workspaceId,
          archivedAt: null
        }
      });

      if (!group) {
        await sendError(reply, 404, "GROUP_NOT_FOUND", "Group was not found.");
        return;
      }

      await prisma.itemGroupItem.deleteMany({
        where: {
          groupId: group.id,
          itemId: request.params.itemId,
          item: {
            workspaceId: workspaceAccess.workspaceId
          }
        }
      });

      return prisma.itemGroup.findUniqueOrThrow({
        where: {
          id: group.id
        },
        include: groupInclude
      });
    }
  );
}
