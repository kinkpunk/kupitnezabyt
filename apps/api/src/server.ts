import cors from "@fastify/cors";
import { prisma } from "@kupitnezabyt/database";
import type { Prisma } from "@kupitnezabyt/database";
import {
  aggregateCategoryStatus,
  calculateNextCheckAt,
  calculateSnoozedUntil,
  getInAppReminders,
  getShoppingSyncAction,
  getRuleBasedRecommendations,
  isItemStatus,
  normalizeName,
  normalizeSearchQuery,
  createUserDataExport,
  parseRecommendationId
} from "@kupitnezabyt/shared";
import Fastify from "fastify";
import type { FastifyReply } from "fastify";

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
  generateOAuthSecret,
  generateMagicLinkToken,
  getBearerToken,
  hashMagicLinkToken,
  hashOAuthSecret,
  isUsableMagicLinkToken,
  isUsableOAuthStateToken,
  normalizeEmail,
  signToken,
  validateTelegramInitData,
  verifyToken
} from "./auth.js";
import type { TelegramUser } from "./auth.js";
import { sendMagicLinkEmail } from "./email.js";
import { getConfig } from "./env.js";
import {
  createGoogleAuthorizationUrl,
  exchangeGoogleCodeForIdToken,
  isGoogleAuthConfigured,
  verifyGoogleIdToken
} from "./google-auth.js";
import { resolveOAuthUser } from "./oauth.js";
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

type ArchivedQuery = {
  archived?: string;
};

type RemindersQuery = {
  days?: string;
};

const config = getConfig();
const authRateLimitWindowMs = 15 * 60 * 1000;
const authRateLimitMaxAttempts = 10;
const authRateLimitBuckets = new Map<string, { count: number; resetAt: number }>();

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
    const now = new Date();
    const upcomingWindowDays = readOptionalPositiveInteger(request.query.days) ?? 7;
    const [categories, groups, items] = await Promise.all([
      prisma.category.findMany({
        where: {
          userId,
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
          userId,
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
          userId,
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

    return {
      token: signToken(user.id, config),
      user
    };
  });

  app.post<{ Body: TelegramAuthBody }>("/api/auth/telegram", async (request, reply) => {
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
    return {
      token: signToken(user.id, config),
      user
    };
  });

  app.post<{ Body: EmailAuthRequestBody }>("/api/auth/email/request", async (request, reply) => {
    const email =
      typeof request.body?.email === "string" ? normalizeEmail(request.body.email) : null;
    const rateLimitKey = email ? `email:${email}` : `ip:${request.ip}`;

    if (!checkAuthRateLimit(rateLimitKey)) {
      await sendError(reply, 429, "RATE_LIMITED", "Too many sign-in attempts.");
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

  app.post("/api/auth/google/start", async (_request, reply) => {
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

  app.post("/api/auth/apple/start", async (_request, reply) => {
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

  app.get("/api/me", async (request) => {
    return prisma.user.findUniqueOrThrow({
      where: {
        id: requireUserId(request.userId)
      }
    });
  });

  app.delete("/api/me", async (request) => {
    await prisma.user.delete({
      where: {
        id: requireUserId(request.userId)
      }
    });

    return {
      deleted: true
    };
  });

  app.get("/api/export/json", async (request) => {
    const userId = requireUserId(request.userId);
    const [
      user,
      categories,
      items,
      shoppingListItems,
      reminders,
      groups,
      checkSessions,
      recommendationDismissals
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
        recommendationDismissals
      }
    });
  });

  app.get<{ Querystring: ArchivedQuery }>("/api/categories", async (request) => {
    const archived = readBooleanFlag(request.query.archived);
    const categories = await prisma.category.findMany({
      where: {
        userId: requireUserId(request.userId),
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
    const categoryCount = await prisma.category.count({
      where: {
        userId
      }
    });

    const category = await prisma.category.create({
      data: {
        userId,
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

  app.get<{ Params: { id: string } }>("/api/categories/:id", async (request, reply) => {
    const category = await prisma.category.findFirst({
      where: {
        id: request.params.id,
        userId: requireUserId(request.userId),
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
      const category = await prisma.category.findFirst({
        where: {
          id: request.params.id,
          userId: requireUserId(request.userId),
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
          userId: requireUserId(request.userId),
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
    const now = new Date();
    const category = await prisma.category.findFirst({
      where: {
        id: request.params.id,
        userId,
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
            userId,
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
            userId,
            archivedAt: null
          },
          select: {
            id: true,
            name: true
          }
        })
      ]);

      await clearRecommendationDismissalsForItems(tx, userId, itemsToArchive, activeItems);

      await tx.item.updateMany({
        where: {
          userId,
          categoryId: category.id,
          archivedAt: null
        },
        data: {
          archivedAt: now
        }
      });

      await tx.shoppingListItem.updateMany({
        where: {
          userId,
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
    const category = await prisma.category.findFirst({
      where: {
        id: request.params.id,
        userId,
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
          userId,
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
          userId,
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
          userId,
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
    const category = await prisma.category.findFirst({
      where: {
        id: request.params.id,
        userId: requireUserId(request.userId),
        archivedAt: {
          not: null
        }
      }
    });

    if (!category) {
      await sendError(reply, 404, "CATEGORY_NOT_FOUND", "Archived category was not found.");
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
      const category = await prisma.category.findFirst({
        where: {
          id: request.params.categoryId,
          userId,
          archivedAt: null
        }
      });

      if (!category) {
        await sendError(reply, 404, "CATEGORY_NOT_FOUND", "Category was not found.");
        return;
      }

      const items = await prisma.item.findMany({
        where: {
          userId,
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

      return prisma.checkSession.create({
        data: {
          userId,
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
    return prisma.itemGroup.findMany({
      where: {
        userId: requireUserId(request.userId),
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

    return prisma.itemGroup.create({
      data: {
        userId: requireUserId(request.userId),
        name,
        icon: readOptionalString(request.body?.icon) ?? null
      },
      include: groupInclude
    });
  });

  app.get<{ Params: { id: string } }>("/api/groups/:id", async (request, reply) => {
    const group = await prisma.itemGroup.findFirst({
      where: {
        id: request.params.id,
        userId: requireUserId(request.userId),
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
      const group = await prisma.itemGroup.findFirst({
        where: {
          id: request.params.id,
          userId: requireUserId(request.userId),
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
    const group = await prisma.itemGroup.findFirst({
      where: {
        id: request.params.id,
        userId: requireUserId(request.userId),
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
      const itemId = readRequiredString(request.body?.itemId);
      if (!itemId) {
        await sendError(reply, 400, "ITEM_ID_REQUIRED", "Item id is required.");
        return;
      }

      const group = await prisma.itemGroup.findFirst({
        where: {
          id: request.params.id,
          userId,
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
          userId,
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
      const group = await prisma.itemGroup.findFirst({
        where: {
          id: request.params.id,
          userId,
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
            userId
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
      const group = await prisma.itemGroup.findFirst({
        where: {
          id: request.params.groupId,
          userId,
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

      return prisma.checkSession.create({
        data: {
          userId,
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
    const categoryId = readOptionalString(request.query.categoryId);
    const archived = readBooleanFlag(request.query.archived);

    return prisma.item.findMany({
      where: {
        userId: requireUserId(request.userId),
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
    const query = normalizeSearchQuery(request.query.q ?? "");
    if (!query) {
      await sendError(reply, 400, "SEARCH_QUERY_REQUIRED", "Search query is required.");
      return;
    }

    return prisma.item.findMany({
      where: {
        userId: requireUserId(request.userId),
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
        userId,
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
          categoryId,
          name,
          status: "NEED_BUY",
          brand: readOptionalString(request.body?.brand) ?? null,
          notes: readOptionalString(request.body?.notes) ?? null,
          usageCycleDays: readOptionalPositiveInteger(request.body?.usageCycleDays) ?? null
        }
      });

      await tx.shoppingListItem.create({
        data: {
          userId,
          itemId: item.id,
          title: item.name,
          categoryId: item.categoryId,
          priority: "NORMAL"
        }
      });

      return item;
    });
  });

  app.get<{ Querystring: { itemId?: string } }>(
    "/api/recommendations",
    async (request, reply) => {
      const userId = requireUserId(request.userId);
      const itemId = readRequiredString(request.query.itemId);
      if (!itemId) {
        await sendError(reply, 400, "ITEM_ID_REQUIRED", "Item id is required.");
        return;
      }

      const triggerItem = await prisma.item.findFirst({
        where: {
          id: itemId,
          userId,
          archivedAt: null
        }
      });

      if (!triggerItem) {
        await sendError(reply, 404, "ITEM_NOT_FOUND", "Item was not found.");
        return;
      }

      return getRecommendationsForItem(userId, triggerItem);
    }
  );

  app.post<{ Body: AcceptRecommendationBody; Params: { id: string } }>(
    "/api/recommendations/:id/accept",
    async (request, reply) => {
      const userId = requireUserId(request.userId);
      const recommendationId = parseRecommendationId(request.params.id);
      if (!recommendationId) {
        await sendError(reply, 400, "INVALID_RECOMMENDATION", "Recommendation id is invalid.");
        return;
      }

      const triggerItem = await prisma.item.findFirst({
        where: {
          id: recommendationId.itemId,
          userId,
          archivedAt: null
        }
      });

      if (!triggerItem) {
        await sendError(reply, 404, "ITEM_NOT_FOUND", "Item was not found.");
        return;
      }

      const activeItems = await prisma.item.findMany({
        where: {
          userId,
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
          userId,
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
            categoryId: category.id,
            name: suggestion.suggestedItem,
            status: "NEED_BUY"
          }
        });

        await tx.shoppingListItem.create({
          data: {
            userId,
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
      const recommendationId = parseRecommendationId(request.params.id);
      if (!recommendationId) {
        await sendError(reply, 400, "INVALID_RECOMMENDATION", "Recommendation id is invalid.");
        return;
      }

      const triggerItem = await prisma.item.findFirst({
        where: {
          id: recommendationId.itemId,
          userId,
          archivedAt: null
        }
      });

      if (!triggerItem) {
        await sendError(reply, 404, "ITEM_NOT_FOUND", "Item was not found.");
        return;
      }

      const suggestion = (await getRecommendationsForItem(userId, triggerItem)).find(
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
          ruleId: recommendationId.ruleId,
          suggestedItem: suggestion.suggestedItem
        }
      });

      return {
        dismissed: true
      };
    }
  );

  app.get<{ Params: { id: string } }>("/api/items/:id", async (request, reply) => {
    const item = await prisma.item.findFirst({
      where: {
        id: request.params.id,
        userId: requireUserId(request.userId),
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
      const item = await prisma.item.findFirst({
        where: {
          id: request.params.id,
          userId,
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
            userId,
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
          ? calculateNextCheckAt(item.status, now, usageCycleDays)
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
            userId,
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
      const status = request.body?.status;
      if (typeof status !== "string" || !isItemStatus(status)) {
        await sendError(reply, 400, "INVALID_STATUS", "Item status is invalid.");
        return;
      }

      try {
        return await prisma.$transaction((tx) =>
          setItemStatus(tx, requireUserId(request.userId), request.params.id, status)
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
      const days = readOptionalPositiveInteger(request.body?.days);
      if (!days) {
        await sendError(reply, 400, "SNOOZE_DAYS_REQUIRED", "Positive snooze days are required.");
        return;
      }

      const item = await prisma.item.findFirst({
        where: {
          id: request.params.id,
          userId,
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
    const now = new Date();
    const item = await prisma.item.findFirst({
      where: {
        id: request.params.id,
        userId,
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
          userId,
          archivedAt: null
        },
        select: {
          id: true,
          name: true
        }
      });

      await clearRecommendationDismissalsForItems(tx, userId, [item], activeItems);

      await tx.shoppingListItem.updateMany({
        where: {
          userId,
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
    const item = await prisma.item.findFirst({
      where: {
        id: request.params.id,
        userId,
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
    const item = await prisma.item.findFirst({
      where: {
        id: request.params.id,
        userId: requireUserId(request.userId),
        archivedAt: {
          not: null
        }
      }
    });

    if (!item) {
      await sendError(reply, 404, "ITEM_NOT_FOUND", "Archived item was not found.");
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
    return prisma.shoppingListItem.findMany({
      where: {
        userId: requireUserId(request.userId),
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
          userId,
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
      const shoppingListItem = await prisma.shoppingListItem.findFirst({
        where: {
          id: request.params.id,
          userId,
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
            userId,
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
      try {
        const completedItem = await prisma.$transaction((tx) =>
          markShoppingListItemBought(tx, requireUserId(request.userId), request.params.id)
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
    const shoppingListItem = await prisma.shoppingListItem.findFirst({
      where: {
        id: request.params.id,
        userId,
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

  app.delete("/api/shopping-list/completed", async (request) => {
    const result = await prisma.shoppingListItem.deleteMany({
      where: {
        userId: requireUserId(request.userId),
        isCompleted: true
      }
    });

    return {
      deletedCount: result.count
    };
  });

  app.get("/api/check/session/active", async (request) => {
    return prisma.checkSession.findFirst({
      where: {
        userId: requireUserId(request.userId),
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
      const session = await prisma.checkSession.findFirst({
        where: {
          id: request.params.sessionId,
          userId: requireUserId(request.userId)
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
      const status = request.body?.status;
      if (typeof status !== "string" || !isItemStatus(status) || status === "PAUSED") {
        await sendError(reply, 400, "INVALID_STATUS", "Item status is invalid for a check.");
        return;
      }

      const session = await prisma.checkSession.findFirst({
        where: {
          id: request.params.sessionId,
          userId,
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
        await setItemStatus(tx, userId, request.params.itemId, status);
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
      const session = await prisma.checkSession.findFirst({
        where: {
          id: request.params.sessionId,
          userId: requireUserId(request.userId),
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
          status: "COMPLETED",
          completedAt: new Date()
        },
        include: checkSessionInclude
      });
    }
  );

  app.post<{ Params: { sessionId: string } }>(
    "/api/check/session/:sessionId/cancel",
    async (request, reply) => {
      const session = await prisma.checkSession.findFirst({
        where: {
          id: request.params.sessionId,
          userId: requireUserId(request.userId),
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
        userId,
        archivedAt: null
      },
      select: {
        id: true,
        name: true
      }
    }),
    prisma.recommendationDismissal.findMany({
      where: {
        userId
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
      OR: dismissalFilters
    }
  });
}

async function syncRestoredItem(
  tx: Prisma.TransactionClient,
  item: {
    id: string;
    userId: string;
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
        userId: item.userId,
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

function checkAuthRateLimit(key: string, now = Date.now()): boolean {
  const bucket = authRateLimitBuckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    authRateLimitBuckets.set(key, {
      count: 1,
      resetAt: now + authRateLimitWindowMs
    });
    return true;
  }

  if (bucket.count >= authRateLimitMaxAttempts) {
    return false;
  }

  bucket.count += 1;
  return true;
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
