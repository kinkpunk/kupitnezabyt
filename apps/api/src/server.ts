import cors from "@fastify/cors";
import { ensurePersonalWorkspace, getPersonalWorkspaceId, prisma } from "@kupitnezabyt/database";
import type { Prisma } from "@kupitnezabyt/database";
import {
  aggregateCategoryStatus,
  calculateNextCheckAt,
  calculateSnoozedUntil,
  getInAppReminders,
  getShoppingSyncAction,
  getRuleBasedRecommendations,
  HIDE_SIMILAR_RECOMMENDATION_ITEM,
  isItemStatus,
  normalizeName,
  normalizeSearchQuery,
  createUserDataExport,
  parseRecommendationId
} from "@kupitnezabyt/shared";
import Fastify from "fastify";
import type { FastifyReply, FastifyRequest } from "fastify";

import {
  createAppleAuthorizationUrl,
  exchangeAppleCodeForIdToken,
  isAppleAuthConfigured,
  isAppleEmailVerified,
  verifyAppleIdToken
} from "./apple-auth.js";
import {
  calculateMagicLinkExpiresAt,
  calculateOAuthStateExpiresAt,
  calculateWorkspaceInvitationExpiresAt,
  generateOAuthSecret,
  generateMagicLinkToken,
  generateWorkspaceInvitationToken,
  getBearerToken,
  hashMagicLinkToken,
  hashOAuthSecret,
  hashWorkspaceInvitationToken,
  isUsableMagicLinkToken,
  isUsableOAuthStateToken,
  isUsableWorkspaceInvitationToken,
  normalizeEmail,
  signToken,
  validateTelegramInitData,
  verifyToken
} from "./auth.js";
import type { TelegramUser } from "./auth.js";
import { sendMagicLinkEmail, sendWorkspaceInvitationEmail } from "./email.js";
import { getConfig } from "./env.js";
import {
  createGoogleAuthorizationUrl,
  exchangeGoogleCodeForIdToken,
  isGoogleAuthConfigured,
  verifyGoogleIdToken
} from "./google-auth.js";
import { resolveOAuthUser } from "./oauth.js";
import { createRateLimiter, type RateLimiter } from "./rate-limit.js";
import { cancelPendingItemCheckReminders, markShoppingListItemBought, setItemStatus, upsertItemCheckReminder } from "./services.js";

type NamedBody = {
  name?: unknown;
  icon?: unknown;
};

type CheckSettingsBody = {
  name?: unknown;
  icon?: unknown;
  usageCycleDays?: unknown;
  nextCheckAt?: unknown;
  reminderEnabled?: unknown;
};

type CreateItemBody = {
  categoryId?: unknown;
  name?: unknown;
  brand?: unknown;
  notes?: unknown;
  usageCycleDays?: unknown;
};

type UpdateItemBody = {
  categoryId?: unknown;
  name?: unknown;
  brand?: unknown;
  notes?: unknown;
  usageCycleDays?: unknown;
  nextCheckAt?: unknown;
  reminderEnabled?: unknown;
};

type StatusBody = {
  status?: unknown;
};

type SnoozeBody = {
  days?: unknown;
};

type DevAuthBody = {
  telegramUserId?: unknown;
  firstName?: unknown;
};

type TelegramAuthBody = {
  initData?: unknown;
};

type EmailAuthRequestBody = {
  email?: unknown;
};

type EmailAuthVerifyBody = {
  token?: unknown;
};

type WorkspaceInvitationBody = {
  email?: unknown;
};

type WorkspaceInvitationAcceptBody = {
  token?: unknown;
};

type WorkspaceTransferOwnershipBody = {
  memberId?: unknown;
};

type GoogleAuthCallbackQuery = {
  code?: string;
  error?: string;
  state?: string;
};

type AppleAuthCallbackBody = {
  code?: string;
  error?: string;
  state?: string;
};

type ShoppingListBody = {
  title?: unknown;
  categoryId?: unknown;
  priority?: unknown;
};

type GroupItemBody = {
  itemId?: unknown;
};

type AcceptRecommendationBody = {
  categoryId?: unknown;
};

type ReorderCategoriesBody = {
  categoryIds?: unknown;
};

type WorkspaceAccess = {
  role: "OWNER" | "EDITOR" | "VIEWER";
  workspaceId: string;
};

type ArchivedQuery = {
  archived?: string;
};

type RemindersQuery = {
  days?: string;
};

const config = getConfig();
const authRateLimiter = createRateLimiter({
  maxAttempts: 10,
  windowMs: 15 * 60 * 1000
});
const sensitiveRateLimiter = createRateLimiter({
  maxAttempts: 10,
  windowMs: 15 * 60 * 1000
});
const invitationRateLimiter = createRateLimiter({
  maxAttempts: 20,
  windowMs: 60 * 60 * 1000
});

export function buildServer() {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? "info",
      redact: [
        "req.headers.authorization",
        "req.headers.cookie",
        "req.body.email",
        "req.body.initData",
        "req.body.token"
      ]
    }
  });

  void app.register(cors, {
    origin: config.appBaseUrl,
    credentials: true,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"]
  });

  app.addContentTypeParser(
    "application/x-www-form-urlencoded",
    {
      parseAs: "string"
    },
    (_request, body, done) => {
      done(null, Object.fromEntries(new URLSearchParams(body.toString())));
    }
  );

  app.addHook("preHandler", async (request, reply) => {
    if (request.url === "/health" || request.url === "/health/detailed" || request.url.startsWith("/api/auth/")) {
      return;
    }

    const token = getBearerToken(request);
    const payload = token ? verifyToken(token, config) : null;
    if (!payload) {
      await sendError(reply, 401, "UNAUTHORIZED", "Authorization is required.");
      return;
    }

    request.userId = payload.sub;
  });

  app.get("/health", async () => ({ ok: true }));

  app.get("/health/detailed", async (_request, reply) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch {
      reply.code(503);
      return {
        ok: false,
        db: false,
        env: config.nodeEnv,
        commit: process.env.RENDER_GIT_COMMIT ?? null
      };
    }

    return {
      ok: true,
      db: true,
      env: config.nodeEnv,
      commit: process.env.RENDER_GIT_COMMIT ?? null
    };
  });

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

  app.post<{ Body: DevAuthBody }>("/api/auth/dev", async (request, reply) => {
    if (config.nodeEnv !== "development" || !config.devAuthEnabled) {
      await sendError(reply, 404, "NOT_FOUND", "Development auth is not enabled.");
      return;
    }

    const telegramUserId =
      typeof request.body?.telegramUserId === "string" && request.body.telegramUserId.trim()
        ? `dev:${request.body.telegramUserId.trim()}`
        : "dev:local";
    const firstName =
      typeof request.body?.firstName === "string" && request.body.firstName.trim()
        ? request.body.firstName.trim()
        : "Dev";

    const user = await prisma.user.upsert({
      where: { telegramUserId },
      update: { firstName },
      create: {
        telegramUserId,
        firstName,
        language: "ru",
        timezone: "Europe/Minsk"
      }
    });
    await ensurePersonalWorkspace(prisma, {
      userId: user.id,
      name: firstName
    });

    return {
      token: signToken(user.id, config),
      user
    };
  });

  app.post<{ Body: TelegramAuthBody }>("/api/auth/telegram", async (request, reply) => {
    if (!(await checkRateLimit(reply, authRateLimiter, `auth:telegram:${request.ip}`))) {
      return;
    }

    if (typeof request.body?.initData !== "string" || !config.telegramBotToken) {
      await sendError(reply, 400, "INVALID_TELEGRAM_AUTH", "Telegram init data is invalid.");
      return;
    }

    const telegramUser = validateTelegramInitData(
      request.body.initData,
      config.telegramBotToken
    );

    if (!telegramUser) {
      await sendError(reply, 401, "INVALID_TELEGRAM_AUTH", "Telegram init data is invalid.");
      return;
    }

    const user = await upsertTelegramUser(telegramUser);
    await ensurePersonalWorkspace(prisma, {
      userId: user.id,
      name: user.firstName
    });
    return {
      token: signToken(user.id, config),
      user
    };
  });

  app.post<{ Body: EmailAuthRequestBody }>("/api/auth/email/request", async (request, reply) => {
    const email =
      typeof request.body?.email === "string" ? normalizeEmail(request.body.email) : null;
    const rateLimitKey = email ? `auth:email:${email}` : `auth:email-ip:${request.ip}`;

    if (!(await checkRateLimit(reply, authRateLimiter, rateLimitKey))) {
      return;
    }

    if (!email) {
      await sendError(reply, 400, "INVALID_EMAIL", "Email is invalid.");
      return;
    }

    const rawToken = generateMagicLinkToken();
    const tokenHash = hashMagicLinkToken(rawToken, config);
    const expiresAt = calculateMagicLinkExpiresAt(
      new Date(),
      config.magicLinkTokenTtlMinutes
    );
    const magicLink = `${config.appBaseUrl}/?magic_token=${encodeURIComponent(rawToken)}`;

    await prisma.magicLinkToken.create({
      data: {
        email,
        tokenHash,
        expiresAt
      }
    });

    try {
      const emailResult = await sendMagicLinkEmail({
        config,
        email,
        magicLink
      });

      return {
        sent: true,
        ...(emailResult.devMagicLink ? { devMagicLink: emailResult.devMagicLink } : {})
      };
    } catch (error) {
      request.log.error({ error }, "Failed to send magic link email");
      await sendError(reply, 503, "EMAIL_SEND_FAILED", "Unable to send sign-in email.");
      return;
    }
  });

  app.post<{ Body: EmailAuthVerifyBody }>("/api/auth/email/verify", async (request, reply) => {
    if (typeof request.body?.token !== "string" || !request.body.token.trim()) {
      await sendError(reply, 400, "INVALID_MAGIC_LINK", "Magic link is invalid.");
      return;
    }

    const now = new Date();
    const tokenHash = hashMagicLinkToken(request.body.token.trim(), config);

    const result = await prisma.$transaction(async (tx) => {
      const magicLinkToken = await tx.magicLinkToken.findUnique({
        where: {
          tokenHash
        }
      });

      if (!isUsableMagicLinkToken(magicLinkToken, now)) {
        return null;
      }

      const consumeResult = await tx.magicLinkToken.updateMany({
        where: {
          id: magicLinkToken.id,
          consumedAt: null
        },
        data: {
          consumedAt: now
        }
      });

      if (consumeResult.count !== 1) {
        return null;
      }

      const user = await tx.user.upsert({
        where: {
          email: magicLinkToken.email
        },
        update: {
          emailVerifiedAt: now
        },
        create: {
          email: magicLinkToken.email,
          emailVerifiedAt: now,
          language: "ru",
          timezone: "Europe/Minsk"
        }
      });
      await ensurePersonalWorkspace(tx, {
        userId: user.id,
        name: user.displayName ?? user.email,
        now
      });

      return user;
    });

    if (!result) {
      await sendError(reply, 401, "INVALID_MAGIC_LINK", "Magic link is invalid or expired.");
      return;
    }

    return {
      token: signToken(result.id, config),
      user: result
    };
  });

  app.post("/api/auth/google/start", async (request, reply) => {
    if (!(await checkRateLimit(reply, authRateLimiter, `auth:google:${request.ip}`))) {
      return;
    }

    if (!isGoogleAuthConfigured(config)) {
      await sendError(reply, 404, "GOOGLE_AUTH_NOT_CONFIGURED", "Google sign-in is not configured.");
      return;
    }

    const state = generateOAuthSecret();
    const nonce = generateOAuthSecret();
    await prisma.oAuthStateToken.create({
      data: {
        provider: "GOOGLE",
        stateHash: hashOAuthSecret(state, config),
        nonceHash: hashOAuthSecret(nonce, config),
        expiresAt: calculateOAuthStateExpiresAt(new Date())
      }
    });

    return {
      authUrl: createGoogleAuthorizationUrl(config, state, nonce)
    };
  });

  app.get<{ Querystring: GoogleAuthCallbackQuery }>(
    "/api/auth/google/callback",
    async (request, reply) => {
      const redirectWithError = (error: string) =>
        reply.redirect(`${config.appBaseUrl}/?oauth_error=${encodeURIComponent(error)}`);

      if (request.query.error) {
        return redirectWithError("GOOGLE_AUTH_CANCELLED");
      }

      if (!isGoogleAuthConfigured(config) || !config.googleClientId) {
        return redirectWithError("GOOGLE_AUTH_NOT_CONFIGURED");
      }

      if (!request.query.code || !request.query.state) {
        return redirectWithError("GOOGLE_AUTH_INVALID_CALLBACK");
      }

      const now = new Date();
      const stateHash = hashOAuthSecret(request.query.state, config);
      const stateToken = await prisma.$transaction(async (tx) => {
        const token = await tx.oAuthStateToken.findUnique({
          where: {
            stateHash
          }
        });

        if (!token || token.provider !== "GOOGLE" || !isUsableOAuthStateToken(token, now)) {
          return null;
        }

        const consumeResult = await tx.oAuthStateToken.updateMany({
          where: {
            id: token.id,
            consumedAt: null
          },
          data: {
            consumedAt: now
          }
        });

        return consumeResult.count === 1 ? token : null;
      });

      if (!stateToken) {
        return redirectWithError("GOOGLE_AUTH_INVALID_STATE");
      }

      try {
        const idToken = await exchangeGoogleCodeForIdToken(config, request.query.code);
        const payload = await verifyGoogleIdToken(idToken, config.googleClientId, now);
        if (
          !payload?.email ||
          hashOAuthSecret(payload.nonce ?? "", config) !== stateToken.nonceHash
        ) {
          return redirectWithError("GOOGLE_AUTH_INVALID_TOKEN");
        }

        const user = await prisma.$transaction((tx) =>
          resolveOAuthUser(
            tx,
            {
              provider: "GOOGLE",
              providerAccountId: payload.sub,
              email: payload.email ?? null,
              emailVerified: payload.email_verified === true,
              displayName: payload.name ?? null
            },
            now
          )
        );
        const token = signToken(user.id, config);
        return reply.redirect(`${config.appBaseUrl}/?oauth_token=${encodeURIComponent(token)}`);
      } catch (error) {
        request.log.error({ error }, "Google sign-in failed");
        return redirectWithError("GOOGLE_AUTH_FAILED");
      }
    }
  );

  app.post("/api/auth/apple/start", async (request, reply) => {
    if (!(await checkRateLimit(reply, authRateLimiter, `auth:apple:${request.ip}`))) {
      return;
    }

    if (!isAppleAuthConfigured(config)) {
      await sendError(reply, 404, "APPLE_AUTH_NOT_CONFIGURED", "Apple sign-in is not configured.");
      return;
    }

    const state = generateOAuthSecret();
    const nonce = generateOAuthSecret();
    await prisma.oAuthStateToken.create({
      data: {
        provider: "APPLE",
        stateHash: hashOAuthSecret(state, config),
        nonceHash: hashOAuthSecret(nonce, config),
        expiresAt: calculateOAuthStateExpiresAt(new Date())
      }
    });

    return {
      authUrl: createAppleAuthorizationUrl(config, state, nonce)
    };
  });

  app.post<{ Body: AppleAuthCallbackBody }>(
    "/api/auth/apple/callback",
    async (request, reply) => {
      const redirectWithError = (error: string) =>
        reply.redirect(`${config.appBaseUrl}/?oauth_error=${encodeURIComponent(error)}`);

      if (request.body?.error) {
        return redirectWithError("APPLE_AUTH_CANCELLED");
      }

      if (!isAppleAuthConfigured(config) || !config.appleClientId) {
        return redirectWithError("APPLE_AUTH_NOT_CONFIGURED");
      }

      if (!request.body?.code || !request.body.state) {
        return redirectWithError("APPLE_AUTH_INVALID_CALLBACK");
      }

      const now = new Date();
      const stateHash = hashOAuthSecret(request.body.state, config);
      const stateToken = await prisma.$transaction(async (tx) => {
        const token = await tx.oAuthStateToken.findUnique({
          where: {
            stateHash
          }
        });

        if (!token || token.provider !== "APPLE" || !isUsableOAuthStateToken(token, now)) {
          return null;
        }

        const consumeResult = await tx.oAuthStateToken.updateMany({
          where: {
            id: token.id,
            consumedAt: null
          },
          data: {
            consumedAt: now
          }
        });

        return consumeResult.count === 1 ? token : null;
      });

      if (!stateToken) {
        return redirectWithError("APPLE_AUTH_INVALID_STATE");
      }

      try {
        const idToken = await exchangeAppleCodeForIdToken(config, request.body.code);
        const payload = await verifyAppleIdToken(idToken, config.appleClientId, now);
        if (
          !payload ||
          hashOAuthSecret(payload.nonce ?? "", config) !== stateToken.nonceHash
        ) {
          return redirectWithError("APPLE_AUTH_INVALID_TOKEN");
        }

        const user = await prisma.$transaction((tx) =>
          resolveOAuthUser(
            tx,
            {
              provider: "APPLE",
              providerAccountId: payload.sub,
              email: payload.email ?? null,
              emailVerified: isAppleEmailVerified(payload.email_verified),
              displayName: null
            },
            now
          )
        );
        const token = signToken(user.id, config);
        return reply.redirect(`${config.appBaseUrl}/?oauth_token=${encodeURIComponent(token)}`);
      } catch (error) {
        request.log.error({ error }, "Apple sign-in failed");
        return redirectWithError("APPLE_AUTH_FAILED");
      }
    }
  );

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
        orderBy: {
          createdAt: "asc"
        }
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
          orderBy: {
            createdAt: "asc"
          }
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
        orderBy: {
          createdAt: "asc"
        }
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
        include: groupInclude
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

  app.get<{ Querystring: { categoryId?: string } & ArchivedQuery }>("/api/items", async (request) => {
    const userId = requireUserId(request.userId);
    const workspaceAccess = await resolveWorkspaceAccess(request, userId);
    if (!workspaceAccess) {
      return [];
    }
    const categoryId = readOptionalString(request.query.categoryId);
    const archived = readBooleanFlag(request.query.archived);

    return prisma.item.findMany({
      where: {
        workspaceId: workspaceAccess.workspaceId,
        ...(categoryId ? { categoryId } : {}),
        archivedAt: archived ? { not: null } : null
      },
      include: {
        category: true
      },
      orderBy: {
        createdAt: "asc"
      }
    });
  });

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
    const initialStatus = usageCycleDays ? "IN_STOCK" : "NEED_BUY";
    const now = new Date();

    return prisma.$transaction(async (tx) => {
      const item = await tx.item.create({
        data: {
          userId,
          workspaceId: workspaceAccess.workspaceId,
          categoryId,
          name,
          status: initialStatus,
          brand: readOptionalString(request.body?.brand) ?? null,
          notes: readOptionalString(request.body?.notes) ?? null,
          usageCycleDays,
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

  app.get<{ Querystring: { itemId?: string } }>(
    "/api/recommendations",
    async (request, reply) => {
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
    }
  );

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

  app.post<{ Params: { id: string } }>(
    "/api/recommendations/:id/dismiss",
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
    }
  );

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
      const usageCycleDays = hasOwnProperty(body, "usageCycleDays")
        ? readOptionalPositiveInteger(body.usageCycleDays) ?? null
        : item.usageCycleDays;
      const brand = hasOwnProperty(body, "brand")
        ? readOptionalString(body.brand) ?? null
        : item.brand;
      const notes = hasOwnProperty(body, "notes")
        ? readOptionalString(body.notes) ?? null
        : item.notes;
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
        const updatedItem = await tx.item.update({
          where: {
            id: item.id
          },
          data: {
            name,
            categoryId: nextCategoryId,
            brand,
            notes,
            usageCycleDays,
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

  return app;
}

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

async function getRecommendationsForItem(
  userId: string,
  workspaceId: string,
  triggerItem: {
    id: string;
    name: string;
    createdAt?: Date | null;
    lastBoughtAt?: Date | null;
  }
) {
  const [activeItems, dismissals] = await Promise.all([
    prisma.item.findMany({
      where: {
        workspaceId,
        archivedAt: null
      },
      select: {
        id: true,
        name: true
      }
    }),
    prisma.recommendationDismissal.findMany({
      where: {
        userId,
        workspaceId
      },
      select: {
        ruleId: true,
        suggestedItem: true,
        createdAt: true
      }
    })
  ]);

  return getRuleBasedRecommendations({
    triggerItem,
    userItems: activeItems,
    dismissals,
    limit: 5
  });
}

async function clearRecommendationDismissalsForItems(
  tx: Prisma.TransactionClient,
  userId: string,
  workspaceId: string,
  triggerItems: {
    id: string;
    name: string;
    createdAt?: Date | null;
    lastBoughtAt?: Date | null;
  }[],
  activeItems: {
    id: string;
    name: string;
  }[]
): Promise<void> {
  const dismissalKeys = new Map<string, { ruleId: string; suggestedItem: string }>();

  for (const triggerItem of triggerItems) {
    const suggestions = getRuleBasedRecommendations({
      triggerItem,
      userItems: activeItems,
      dismissals: [],
      limit: 50
    });

    for (const suggestion of suggestions) {
      dismissalKeys.set(`${suggestion.ruleId}:${normalizeName(suggestion.suggestedItem)}`, {
        ruleId: suggestion.ruleId,
        suggestedItem: suggestion.suggestedItem
      });
      dismissalKeys.set(`${suggestion.ruleId}:${HIDE_SIMILAR_RECOMMENDATION_ITEM}`, {
        ruleId: suggestion.ruleId,
        suggestedItem: HIDE_SIMILAR_RECOMMENDATION_ITEM
      });
    }
  }

  const dismissalFilters = [...dismissalKeys.values()].map((dismissal) => ({
    ruleId: dismissal.ruleId,
    suggestedItem: dismissal.suggestedItem
  }));

  if (!dismissalFilters.length) {
    return;
  }

  await tx.recommendationDismissal.deleteMany({
    where: {
      userId,
      workspaceId,
      OR: dismissalFilters
    }
  });
}

async function syncRestoredItem(
  tx: Prisma.TransactionClient,
  item: {
    id: string;
    userId: string;
    workspaceId?: string | null;
    categoryId: string;
    name: string;
    status: string;
    nextCheckAt: Date | null;
  }
): Promise<void> {
  if (!isItemStatus(item.status)) {
    return;
  }

  const action = getShoppingSyncAction(item.status);

  if (action.type === "UPSERT") {
    const openShoppingListItem = await tx.shoppingListItem.findFirst({
      where: {
        workspaceId: item.workspaceId ?? getPersonalWorkspaceId(item.userId),
        itemId: item.id,
        isCompleted: false
      }
    });

    if (openShoppingListItem) {
      await tx.shoppingListItem.update({
        where: {
          id: openShoppingListItem.id
        },
        data: {
          title: item.name,
          categoryId: item.categoryId,
          priority: action.priority
        }
      });
    } else {
      await tx.shoppingListItem.create({
        data: {
          userId: item.userId,
          workspaceId: item.workspaceId ?? getPersonalWorkspaceId(item.userId),
          itemId: item.id,
          title: item.name,
          categoryId: item.categoryId,
          priority: action.priority
        }
      });
    }
  }

  if (item.nextCheckAt) {
    await upsertItemCheckReminder(tx, {
      userId: item.userId,
      workspaceId: item.workspaceId ?? getPersonalWorkspaceId(item.userId),
      itemId: item.id,
      scheduledFor: item.nextCheckAt
    });
  }
}

async function sendError(
  reply: FastifyReply,
  statusCode: number,
  code: string,
  message: string
): Promise<void> {
  await reply.code(statusCode).send({
    error: {
      code,
      message
    }
  });
}

async function upsertTelegramUser(telegramUser: TelegramUser) {
  return prisma.user.upsert({
    where: {
      telegramUserId: String(telegramUser.id)
    },
    update: {
      telegramUsername: telegramUser.username ?? null,
      firstName: telegramUser.first_name ?? null,
      language: telegramUser.language_code ?? "ru"
    },
    create: {
      telegramUserId: String(telegramUser.id),
      telegramUsername: telegramUser.username ?? null,
      firstName: telegramUser.first_name ?? null,
      language: telegramUser.language_code ?? "ru",
      timezone: "Europe/Minsk"
    }
  });
}

function requireUserId(userId: string | undefined): string {
  if (!userId) {
    throw new Error("Missing auth context");
  }

  return userId;
}

async function resolveWorkspaceAccess(
  request: FastifyRequest,
  userId: string
): Promise<WorkspaceAccess | null> {
  const requestedWorkspaceId = readWorkspaceIdHeader(request);
  const personalWorkspaceId = getPersonalWorkspaceId(userId);

  if (!requestedWorkspaceId || requestedWorkspaceId === personalWorkspaceId) {
    return {
      role: "OWNER",
      workspaceId: personalWorkspaceId
    };
  }

  const membership = await prisma.workspaceMember.findFirst({
    where: {
      userId,
      workspaceId: requestedWorkspaceId,
      joinedAt: {
        not: null
      }
    },
    select: {
      role: true,
      workspaceId: true
    }
  });

  return membership
    ? {
        role: membership.role,
        workspaceId: membership.workspaceId
      }
    : null;
}

function canWriteWorkspace(workspaceAccess: WorkspaceAccess): boolean {
  return workspaceAccess.role === "OWNER" || workspaceAccess.role === "EDITOR";
}

function readWorkspaceIdHeader(request: FastifyRequest): string | null {
  const header = request.headers["x-workspace-id"];
  const value = Array.isArray(header) ? header[0] : header;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

async function checkRateLimit(
  reply: FastifyReply,
  limiter: RateLimiter,
  key: string
): Promise<boolean> {
  if (limiter.consume(key)) {
    return true;
  }

  await sendError(reply, 429, "RATE_LIMITED", "Too many attempts. Please try again later.");
  return false;
}

function readRequiredString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function readOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function readStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const values: string[] = [];
  for (const currentValue of value) {
    const parsedValue = readRequiredString(currentValue);
    if (!parsedValue) {
      return null;
    }

    values.push(parsedValue);
  }

  return values;
}

function readOptionalPositiveInteger(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return undefined;
  }

  return parsed;
}

function readOptionalBoolean(value: unknown): boolean | undefined {
  if (typeof value !== "boolean") {
    return undefined;
  }

  return value;
}

function readNullableDate(value: unknown): { value: Date | null; invalid: boolean } {
  if (value === null || value === "") {
    return { value: null, invalid: false };
  }

  if (typeof value !== "string") {
    return { value: null, invalid: true };
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return { value: null, invalid: true };
  }

  return { value: date, invalid: false };
}

function calculateConfiguredNextCheckAt(now: Date, usageCycleDays: number | null): Date | null {
  return usageCycleDays ? calculateNextCheckAt("IN_STOCK", now, usageCycleDays) : null;
}

function readBooleanFlag(value: unknown): boolean {
  return value === "true" || value === "1";
}

function readShoppingPriority(value: unknown): "NORMAL" | "URGENT" | null {
  if (value === undefined || value === null || value === "") {
    return "NORMAL";
  }

  return value === "NORMAL" || value === "URGENT" ? value : null;
}

function hasOwnProperty<TObject extends object, TKey extends PropertyKey>(
  value: TObject,
  key: TKey
): value is TObject & Record<TKey, unknown> {
  return Object.prototype.hasOwnProperty.call(value, key);
}
