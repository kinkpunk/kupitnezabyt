import cors from "@fastify/cors";
import Fastify from "fastify";

import { getBearerToken, verifyToken } from "./auth.js";
import { getConfig } from "./env.js";
import { sendError } from "./lib/helpers.js";

import authRoutes from "./routes/auth.js";
import categoryRoutes from "./routes/categories.js";
import checkSessionRoutes from "./routes/check-sessions.js";
import exportRoutes from "./routes/export.js";
import groupRoutes from "./routes/groups.js";
import healthRoutes from "./routes/health.js";
import itemRoutes from "./routes/items.js";
import meRoutes from "./routes/me.js";
import reminderRoutes from "./routes/reminders.js";
import shoppingListRoutes from "./routes/shopping-list.js";
import workspaceRoutes from "./routes/workspaces.js";

const config = getConfig();

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

  void app.register(healthRoutes);
  void app.register(authRoutes);
  void app.register(workspaceRoutes);
  void app.register(meRoutes);
  void app.register(exportRoutes);
  void app.register(categoryRoutes);
  void app.register(groupRoutes);
  void app.register(itemRoutes);
  void app.register(shoppingListRoutes);
  void app.register(reminderRoutes);
  void app.register(checkSessionRoutes);

  return app;
}
