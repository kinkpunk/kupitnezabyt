import { ensurePersonalWorkspace, prisma } from "@kupitnezabyt/database";
import type { FastifyInstance } from "fastify";

import {
  calculateMagicLinkExpiresAt,
  calculateOAuthStateExpiresAt,
  generateMagicLinkToken,
  generateOAuthSecret,
  hashMagicLinkToken,
  hashOAuthSecret,
  isUsableMagicLinkToken,
  isUsableOAuthStateToken,
  normalizeEmail,
  signToken,
  validateTelegramInitData
} from "../auth.js";
import { sendMagicLinkEmail } from "../email.js";
import { getConfig } from "../env.js";
import {
  createAppleAuthorizationUrl,
  exchangeAppleCodeForIdToken,
  isAppleAuthConfigured,
  isAppleEmailVerified,
  verifyAppleIdToken
} from "../apple-auth.js";
import {
  createGoogleAuthorizationUrl,
  exchangeGoogleCodeForIdToken,
  isGoogleAuthConfigured,
  verifyGoogleIdToken
} from "../google-auth.js";
import { checkRateLimit, sendError } from "../lib/helpers.js";
import { upsertTelegramUser } from "../lib/telegram-user.js";
import { resolveOAuthUser } from "../oauth.js";
import { authRateLimiter } from "../lib/rate-limiters.js";
import type {
  AppleAuthCallbackBody,
  DevAuthBody,
  EmailAuthRequestBody,
  EmailAuthVerifyBody,
  GoogleAuthCallbackQuery,
  TelegramAuthBody
} from "../lib/types.js";

const config = getConfig();

export default async function authRoutes(app: FastifyInstance) {
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

    const telegramUser = validateTelegramInitData(request.body.initData, config.telegramBotToken);

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
    const expiresAt = calculateMagicLinkExpiresAt(new Date(), config.magicLinkTokenTtlMinutes);
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

  app.get("/api/auth/providers", async () => ({
    google: isGoogleAuthConfigured(config),
    apple: isAppleAuthConfigured(config)
  }));

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
}
