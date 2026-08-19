import { prisma } from "@kupitnezabyt/database";
import type { FastifyInstance } from "fastify";

import { getConfig } from "../env.js";

const config = getConfig();

export default async function healthRoutes(app: FastifyInstance) {
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
}
