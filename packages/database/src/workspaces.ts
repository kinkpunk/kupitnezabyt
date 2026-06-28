import type { Prisma, PrismaClient, Workspace } from "@prisma/client";

type WorkspaceClient = Pick<PrismaClient | Prisma.TransactionClient, "workspace" | "workspaceMember">;

export function getPersonalWorkspaceId(userId: string): string {
  return `workspace_${userId}`;
}

export function getPersonalWorkspaceMemberId(userId: string): string {
  return `workspace_member_${userId}`;
}

export async function ensurePersonalWorkspace(
  client: WorkspaceClient,
  input: {
    userId: string;
    name?: string | null;
    now?: Date;
  }
): Promise<Workspace> {
  const now = input.now ?? new Date();
  const workspaceId = getPersonalWorkspaceId(input.userId);
  const workspace = await client.workspace.upsert({
    where: {
      id: workspaceId
    },
    update: {},
    create: {
      id: workspaceId,
      ownerId: input.userId,
      name: input.name?.trim() || "Личный список",
      createdAt: now,
      updatedAt: now
    }
  });

  await client.workspaceMember.upsert({
    where: {
      workspaceId_userId: {
        workspaceId,
        userId: input.userId
      }
    },
    update: {
      role: "OWNER",
      joinedAt: now
    },
    create: {
      id: getPersonalWorkspaceMemberId(input.userId),
      workspaceId,
      userId: input.userId,
      role: "OWNER",
      joinedAt: now,
      createdAt: now,
      updatedAt: now
    }
  });

  return workspace;
}
