import { ensurePersonalWorkspace, prisma } from "@kupitnezabyt/database";
import type { FastifyInstance } from "fastify";

import { getConfig } from "../env.js";
import {
  calculateWorkspaceInvitationExpiresAt,
  generateWorkspaceInvitationToken,
  hashWorkspaceInvitationToken,
  isUsableWorkspaceInvitationToken,
  normalizeEmail
} from "../auth.js";
import { sendWorkspaceInvitationEmail } from "../email.js";
import { checkRateLimit, requireUserId, sendError } from "../lib/helpers.js";
import { invitationRateLimiter } from "../lib/rate-limiters.js";
import type {
  WorkspaceInvitationAcceptBody,
  WorkspaceInvitationBody,
  WorkspaceTransferOwnershipBody
} from "../lib/types.js";

const config = getConfig();

export default async function workspaceRoutes(app: FastifyInstance) {
  app.get("/api/workspaces", async (request) => {
    const userId = requireUserId(request.userId);
    await ensurePersonalWorkspace(prisma, {
      userId,
      name: "Личный список"
    });

    const memberships = await prisma.workspaceMember.findMany({
      where: {
        userId
      },
      orderBy: {
        joinedAt: "asc"
      },
      select: {
        id: true,
        role: true,
        joinedAt: true,
        workspace: {
          select: {
            id: true,
            name: true,
            ownerId: true,
            owner: {
              select: {
                id: true,
                email: true,
                displayName: true,
                firstName: true
              }
            },
            _count: {
              select: {
                members: true
              }
            }
          }
        }
      }
    });

    return memberships.map((membership) => ({
      id: membership.workspace.id,
      name: membership.workspace.name,
      ownerId: membership.workspace.ownerId,
      role: membership.role,
      joinedAt: membership.joinedAt,
      memberCount: membership.workspace._count.members,
      owner: membership.workspace.owner
    }));
  });

  app.post<{ Params: { workspaceId: string }; Body: WorkspaceInvitationBody }>(
    "/api/workspaces/:workspaceId/invitations",
    async (request, reply) => {
      const userId = requireUserId(request.userId);
      if (
        !(await checkRateLimit(
          reply,
          invitationRateLimiter,
          `workspace-invite:${userId}:${request.params.workspaceId}`
        ))
      ) {
        return;
      }

      const email =
        typeof request.body?.email === "string" ? normalizeEmail(request.body.email) : null;
      if (!email) {
        await sendError(reply, 400, "INVALID_EMAIL", "Email is invalid.");
        return;
      }

      const workspace = await prisma.workspace.findFirst({
        where: {
          id: request.params.workspaceId,
          ownerId: userId
        },
        select: {
          id: true,
          name: true,
          ownerId: true
        }
      });

      if (!workspace) {
        await sendError(reply, 404, "WORKSPACE_NOT_FOUND", "Workspace was not found.");
        return;
      }

      const invitedUser = await prisma.user.findUnique({
        where: {
          email
        },
        select: {
          id: true,
          email: true,
          emailVerifiedAt: true
        }
      });

      if (!invitedUser?.emailVerifiedAt) {
        await sendError(reply, 404, "INVITEE_NOT_FOUND", "Verified user was not found.");
        return;
      }

      if (invitedUser.id === userId) {
        await sendError(reply, 400, "CANNOT_INVITE_SELF", "You cannot invite yourself.");
        return;
      }

      const existingMember = await prisma.workspaceMember.findUnique({
        where: {
          workspaceId_userId: {
            workspaceId: workspace.id,
            userId: invitedUser.id
          }
        },
        select: {
          id: true
        }
      });

      if (existingMember) {
        await sendError(reply, 409, "ALREADY_MEMBER", "User is already a workspace member.");
        return;
      }

      const now = new Date();
      const rawToken = generateWorkspaceInvitationToken();
      const invitationLink = `${config.appBaseUrl}/?workspace_invite_token=${encodeURIComponent(
        rawToken
      )}`;
      const invitation = await prisma.workspaceInvitation.create({
        data: {
          workspaceId: workspace.id,
          invitedById: userId,
          email,
          role: "EDITOR",
          tokenHash: hashWorkspaceInvitationToken(rawToken, config),
          expiresAt: calculateWorkspaceInvitationExpiresAt(now)
        },
        select: {
          id: true,
          email: true,
          expiresAt: true,
          role: true,
          workspaceId: true
        }
      });

      try {
        const emailResult = await sendWorkspaceInvitationEmail({
          config,
          email,
          invitationLink,
          workspaceName: workspace.name
        });

        return {
          sent: true,
          invitation,
          ...(emailResult.devInvitationLink
            ? { devInvitationLink: emailResult.devInvitationLink }
            : {})
        };
      } catch (error) {
        request.log.error({ error }, "Failed to send workspace invitation email");
        return {
          sent: false,
          invitation
        };
      }
    }
  );

  app.get<{ Params: { workspaceId: string } }>(
    "/api/workspaces/:workspaceId/invitations",
    async (request, reply) => {
      const userId = requireUserId(request.userId);
      const workspace = await prisma.workspace.findFirst({
        where: {
          id: request.params.workspaceId,
          ownerId: userId
        },
        select: {
          id: true,
          name: true
        }
      });

      if (!workspace) {
        await sendError(reply, 404, "WORKSPACE_NOT_FOUND", "Workspace was not found.");
        return;
      }

      const [invitations, members] = await Promise.all([
        prisma.workspaceInvitation.findMany({
          where: {
            workspaceId: workspace.id,
            acceptedAt: null,
            revokedAt: null
          },
          orderBy: {
            createdAt: "desc"
          },
          select: {
            id: true,
            email: true,
            role: true,
            expiresAt: true,
            createdAt: true
          }
        }),
        prisma.workspaceMember.findMany({
          where: {
            workspaceId: workspace.id
          },
          orderBy: {
            joinedAt: "asc"
          },
          select: {
            id: true,
            role: true,
            joinedAt: true,
            user: {
              select: {
                id: true,
                email: true,
                displayName: true,
                firstName: true
              }
            }
          }
        })
      ]);

      return {
        workspace,
        invitations,
        members
      };
    }
  );

  app.post<{ Params: { invitationId: string } }>(
    "/api/workspace-invitations/:invitationId/revoke",
    async (request, reply) => {
      const userId = requireUserId(request.userId);
      const invitation = await prisma.workspaceInvitation.findFirst({
        where: {
          id: request.params.invitationId,
          workspace: {
            ownerId: userId
          }
        },
        select: {
          id: true,
          acceptedAt: true,
          revokedAt: true
        }
      });

      if (!invitation) {
        await sendError(reply, 404, "INVITATION_NOT_FOUND", "Invitation was not found.");
        return;
      }

      if (invitation.acceptedAt) {
        await sendError(reply, 409, "INVITATION_ALREADY_ACCEPTED", "Invitation is already accepted.");
        return;
      }

      if (invitation.revokedAt) {
        return {
          revoked: true
        };
      }

      await prisma.workspaceInvitation.update({
        where: {
          id: invitation.id
        },
        data: {
          revokedAt: new Date()
        }
      });

      return {
        revoked: true
      };
    }
  );

  app.delete<{ Params: { workspaceId: string; memberId: string } }>(
    "/api/workspaces/:workspaceId/members/:memberId",
    async (request, reply) => {
      const userId = requireUserId(request.userId);
      const membership = await prisma.workspaceMember.findFirst({
        where: {
          id: request.params.memberId,
          workspaceId: request.params.workspaceId,
          workspace: {
            ownerId: userId
          }
        },
        select: {
          id: true,
          role: true,
          userId: true
        }
      });

      if (!membership) {
        await sendError(reply, 404, "MEMBER_NOT_FOUND", "Workspace member was not found.");
        return;
      }

      if (membership.userId === userId || membership.role === "OWNER") {
        await sendError(
          reply,
          409,
          "OWNER_MEMBER_CANNOT_BE_REMOVED",
          "Workspace owner cannot be removed."
        );
        return;
      }

      await prisma.workspaceMember.delete({
        where: {
          id: membership.id
        }
      });

      return {
        removed: true
      };
    }
  );

  app.post<{ Params: { workspaceId: string }; Body: WorkspaceTransferOwnershipBody }>(
    "/api/workspaces/:workspaceId/transfer-ownership",
    async (request, reply) => {
      const userId = requireUserId(request.userId);
      const nextOwnerMemberId =
        typeof request.body?.memberId === "string" ? request.body.memberId.trim() : null;
      if (!nextOwnerMemberId) {
        await sendError(reply, 400, "INVALID_MEMBER", "Member is invalid.");
        return;
      }

      const result = await prisma.$transaction(async (tx) => {
        const workspace = await tx.workspace.findFirst({
          where: {
            id: request.params.workspaceId,
            ownerId: userId
          },
          select: {
            id: true
          }
        });

        if (!workspace) {
          return {
            status: "not_found" as const
          };
        }

        const [currentOwnerMember, nextOwnerMember] = await Promise.all([
          tx.workspaceMember.findUnique({
            where: {
              workspaceId_userId: {
                workspaceId: workspace.id,
                userId
              }
            },
            select: {
              id: true
            }
          }),
          tx.workspaceMember.findFirst({
            where: {
              id: nextOwnerMemberId,
              workspaceId: workspace.id,
              userId: {
                not: userId
              }
            },
            select: {
              id: true,
              userId: true
            }
          })
        ]);

        if (!nextOwnerMember) {
          return {
            status: "member_not_found" as const
          };
        }

        await tx.workspace.update({
          where: {
            id: workspace.id
          },
          data: {
            ownerId: nextOwnerMember.userId
          }
        });

        await tx.workspaceMember.update({
          where: {
            id: nextOwnerMember.id
          },
          data: {
            role: "OWNER"
          }
        });

        if (currentOwnerMember) {
          await tx.workspaceMember.update({
            where: {
              id: currentOwnerMember.id
            },
            data: {
              role: "EDITOR"
            }
          });
        }

        return {
          status: "transferred" as const,
          workspaceId: workspace.id,
          ownerId: nextOwnerMember.userId
        };
      });

      if (result.status === "not_found") {
        await sendError(reply, 404, "WORKSPACE_NOT_FOUND", "Workspace was not found.");
        return;
      }

      if (result.status === "member_not_found") {
        await sendError(reply, 404, "MEMBER_NOT_FOUND", "Workspace member was not found.");
        return;
      }

      return {
        transferred: true,
        workspaceId: result.workspaceId,
        ownerId: result.ownerId
      };
    }
  );

  app.post<{ Body: WorkspaceInvitationAcceptBody }>(
    "/api/workspace-invitations/accept",
    async (request, reply) => {
      const userId = requireUserId(request.userId);
      if (typeof request.body?.token !== "string" || !request.body.token.trim()) {
        await sendError(reply, 400, "INVALID_INVITATION", "Invitation is invalid.");
        return;
      }

      const user = await prisma.user.findUnique({
        where: {
          id: userId
        },
        select: {
          id: true,
          email: true,
          emailVerifiedAt: true
        }
      });

      if (!user?.email || !user.emailVerifiedAt) {
        await sendError(
          reply,
          403,
          "EMAIL_VERIFICATION_REQUIRED",
          "A verified email is required to accept invitations."
        );
        return;
      }

      const now = new Date();
      const tokenHash = hashWorkspaceInvitationToken(request.body.token.trim(), config);
      const result = await prisma.$transaction(async (tx) => {
        const invitation = await tx.workspaceInvitation.findUnique({
          where: {
            tokenHash
          },
          select: {
            id: true,
            workspaceId: true,
            email: true,
            role: true,
            expiresAt: true,
            acceptedAt: true,
            revokedAt: true,
            createdAt: true
          }
        });

        if (!isUsableWorkspaceInvitationToken(invitation, now)) {
          return {
            status: "invalid" as const
          };
        }

        if (invitation.email !== user.email) {
          return {
            status: "email_mismatch" as const
          };
        }

        const consumeResult = await tx.workspaceInvitation.updateMany({
          where: {
            id: invitation.id,
            acceptedAt: null,
            revokedAt: null
          },
          data: {
            acceptedAt: now
          }
        });

        if (consumeResult.count !== 1) {
          return {
            status: "invalid" as const
          };
        }

        const member = await tx.workspaceMember.upsert({
          where: {
            workspaceId_userId: {
              workspaceId: invitation.workspaceId,
              userId
            }
          },
          update: {
            role: invitation.role,
            invitedEmail: invitation.email,
            invitedAt: invitation.createdAt,
            joinedAt: now
          },
          create: {
            workspaceId: invitation.workspaceId,
            userId,
            role: invitation.role,
            invitedEmail: invitation.email,
            invitedAt: invitation.createdAt,
            joinedAt: now
          },
          select: {
            id: true,
            workspaceId: true,
            userId: true,
            role: true,
            joinedAt: true
          }
        });

        return {
          status: "accepted" as const,
          member
        };
      });

      if (result.status === "invalid") {
        await sendError(reply, 401, "INVALID_INVITATION", "Invitation is invalid or expired.");
        return;
      }

      if (result.status === "email_mismatch") {
        await sendError(
          reply,
          403,
          "INVITATION_EMAIL_MISMATCH",
          "Invitation belongs to another email."
        );
        return;
      }

      return {
        accepted: true,
        member: result.member
      };
    }
  );
}
