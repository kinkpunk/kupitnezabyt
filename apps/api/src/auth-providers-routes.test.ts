import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@kupitnezabyt/database", () => ({
  cancelPendingItemCheckReminders: vi.fn(),
  ensurePersonalWorkspace: vi.fn(),
  getPersonalWorkspaceId: (userId: string) => `workspace_${userId}`,
  markShoppingListItemBought: vi.fn(),
  prisma: {},
  setItemStatus: vi.fn(),
  upsertItemCheckReminder: vi.fn()
}));

describe("auth providers route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env.APP_BASE_URL = "http://localhost:3000";
    process.env.JWT_SECRET = "test-secret";
    process.env.NODE_ENV = "test";
  });

  it("reports both providers as configured when all OAuth env vars are set", async () => {
    process.env.GOOGLE_CLIENT_ID = "google-client-id";
    process.env.GOOGLE_CLIENT_SECRET = "google-client-secret";
    process.env.GOOGLE_REDIRECT_URI = "http://localhost:3001/api/auth/google/callback";
    process.env.APPLE_CLIENT_ID = "apple-services-id";
    process.env.APPLE_TEAM_ID = "apple-team-id";
    process.env.APPLE_KEY_ID = "apple-key-id";
    process.env.APPLE_PRIVATE_KEY = "apple-private-key-pem";
    process.env.APPLE_REDIRECT_URI = "http://localhost:3001/api/auth/apple/callback";

    const { buildServer } = await import("./server.js");
    const app = buildServer();

    const response = await app.inject({ method: "GET", url: "/api/auth/providers" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ google: true, apple: true });
  });

  it("reports providers as not configured when their env vars are missing", async () => {
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
    delete process.env.GOOGLE_REDIRECT_URI;
    delete process.env.APPLE_CLIENT_ID;
    delete process.env.APPLE_TEAM_ID;
    delete process.env.APPLE_KEY_ID;
    delete process.env.APPLE_PRIVATE_KEY;
    delete process.env.APPLE_REDIRECT_URI;

    const { buildServer } = await import("./server.js");
    const app = buildServer();

    const response = await app.inject({ method: "GET", url: "/api/auth/providers" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ google: false, apple: false });
  });
});
