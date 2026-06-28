import { beforeEach, describe, expect, it, vi } from "vitest";

const mockSendWorkspaceInvitationEmail = vi.hoisted(() => vi.fn());
const mockEnsurePersonalWorkspace = vi.hoisted(() => vi.fn());

const mockTx = vi.hoisted(() => ({
  workspaceInvitation: {
    findUnique: vi.fn(),
    updateMany: vi.fn()
  },
  workspaceMember: {
    upsert: vi.fn()
  }
}));

const mockPrisma = vi.hoisted(() => ({
  $transaction: vi.fn(),
  user: {
    findUnique: vi.fn()
  },
  workspace: {
    findFirst: vi.fn()
  },
  workspaceInvitation: {
    create: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn()
  },
  workspaceMember: {
    findMany: vi.fn(),
    findUnique: vi.fn()
  }
}));

vi.mock("@kupitnezabyt/database", () => ({
  ensurePersonalWorkspace: mockEnsurePersonalWorkspace,
  getPersonalWorkspaceId: (userId: string) => `workspace_${userId}`,
  prisma: mockPrisma
}));

vi.mock("./email.js", () => ({
  sendMagicLinkEmail: vi.fn(),
  sendWorkspaceInvitationEmail: mockSendWorkspaceInvitationEmail
}));

describe("workspace invitation routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env.APP_BASE_URL = "http://localhost:3000";
    process.env.JWT_SECRET = "test-secret";
    process.env.NODE_ENV = "test";

    mockPrisma.$transaction.mockImplementation((callback) => callback(mockTx));
    mockSendWorkspaceInvitationEmail.mockResolvedValue({
      devInvitationLink: "http://localhost:3000/?workspace_invite_token=dev-token"
    });
  });

  it("lists workspaces available to the signed-in user", async () => {
    const { buildServer } = await import("./server.js");
    const { signToken } = await import("./auth.js");
    const app = buildServer();

    mockPrisma.workspaceMember.findMany.mockResolvedValue([
      {
        id: "membership-1",
        role: "OWNER",
        joinedAt: new Date("2026-06-25T09:00:00.000Z"),
        workspace: {
          id: "workspace_user-1",
          name: "Личный список",
          ownerId: "user-1",
          owner: {
            id: "user-1",
            email: "owner@example.com",
            displayName: "Alice",
            firstName: null
          },
          _count: {
            members: 1
          }
        }
      },
      {
        id: "membership-2",
        role: "EDITOR",
        joinedAt: new Date("2026-06-26T09:00:00.000Z"),
        workspace: {
          id: "workspace-shared",
          name: "Дом",
          ownerId: "owner-2",
          owner: {
            id: "owner-2",
            email: "home@example.com",
            displayName: null,
            firstName: "Юля"
          },
          _count: {
            members: 2
          }
        }
      }
    ]);

    const response = await app.inject({
      method: "GET",
      url: "/api/workspaces",
      headers: {
        authorization: `Bearer ${createToken(signToken, "user-1")}`
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([
      {
        id: "workspace_user-1",
        name: "Личный список",
        ownerId: "user-1",
        role: "OWNER",
        joinedAt: "2026-06-25T09:00:00.000Z",
        memberCount: 1,
        owner: {
          id: "user-1",
          email: "owner@example.com",
          displayName: "Alice",
          firstName: null
        }
      },
      {
        id: "workspace-shared",
        name: "Дом",
        ownerId: "owner-2",
        role: "EDITOR",
        joinedAt: "2026-06-26T09:00:00.000Z",
        memberCount: 2,
        owner: {
          id: "owner-2",
          email: "home@example.com",
          displayName: null,
          firstName: "Юля"
        }
      }
    ]);
    expect(mockEnsurePersonalWorkspace).toHaveBeenCalledWith(mockPrisma, {
      userId: "user-1",
      name: "Личный список"
    });
    expect(mockPrisma.workspaceMember.findMany).toHaveBeenCalledWith({
      where: {
        userId: "user-1"
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

    await app.close();
  });

  it("lets a workspace owner invite a verified email user", async () => {
    const { buildServer } = await import("./server.js");
    const { signToken } = await import("./auth.js");
    const app = buildServer();

    mockPrisma.workspace.findFirst.mockResolvedValue({
      id: "workspace-1",
      name: "Дом",
      ownerId: "owner-1"
    });
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "member-1",
      email: "member@example.com",
      emailVerifiedAt: new Date("2026-06-25T10:00:00.000Z")
    });
    mockPrisma.workspaceMember.findUnique.mockResolvedValue(null);
    mockPrisma.workspaceInvitation.create.mockResolvedValue({
      id: "invitation-1",
      workspaceId: "workspace-1",
      email: "member@example.com",
      role: "EDITOR",
      expiresAt: new Date("2026-07-02T10:00:00.000Z")
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/workspaces/workspace-1/invitations",
      headers: {
        authorization: `Bearer ${createToken(signToken, "owner-1")}`
      },
      payload: {
        email: " MEMBER@Example.COM "
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      sent: true,
      invitation: {
        id: "invitation-1",
        workspaceId: "workspace-1",
        email: "member@example.com",
        role: "EDITOR",
        expiresAt: "2026-07-02T10:00:00.000Z"
      },
      devInvitationLink: "http://localhost:3000/?workspace_invite_token=dev-token"
    });
    expect(mockPrisma.workspace.findFirst).toHaveBeenCalledWith({
      where: {
        id: "workspace-1",
        ownerId: "owner-1"
      },
      select: {
        id: true,
        name: true,
        ownerId: true
      }
    });
    expect(mockPrisma.workspaceInvitation.create).toHaveBeenCalledWith({
      data: {
        workspaceId: "workspace-1",
        invitedById: "owner-1",
        email: "member@example.com",
        role: "EDITOR",
        tokenHash: expect.any(String),
        expiresAt: expect.any(Date)
      },
      select: {
        id: true,
        email: true,
        expiresAt: true,
        role: true,
        workspaceId: true
      }
    });
    expect(mockSendWorkspaceInvitationEmail).toHaveBeenCalledWith({
      config: expect.objectContaining({
        appBaseUrl: "http://localhost:3000"
      }),
      email: "member@example.com",
      invitationLink: expect.stringContaining(
        "http://localhost:3000/?workspace_invite_token="
      ),
      workspaceName: "Дом"
    });

    await app.close();
  });

  it("rejects invite creation by non-owners", async () => {
    const { buildServer } = await import("./server.js");
    const { signToken } = await import("./auth.js");
    const app = buildServer();

    mockPrisma.workspace.findFirst.mockResolvedValue(null);

    const response = await app.inject({
      method: "POST",
      url: "/api/workspaces/workspace-1/invitations",
      headers: {
        authorization: `Bearer ${createToken(signToken, "member-1")}`
      },
      payload: {
        email: "owner@example.com"
      }
    });

    expect(response.statusCode).toBe(404);
    expect(mockPrisma.workspaceInvitation.create).not.toHaveBeenCalled();
    expect(mockSendWorkspaceInvitationEmail).not.toHaveBeenCalled();

    await app.close();
  });

  it("lists pending invitations and members for workspace owners", async () => {
    const { buildServer } = await import("./server.js");
    const { signToken } = await import("./auth.js");
    const app = buildServer();

    mockPrisma.workspace.findFirst.mockResolvedValue({
      id: "workspace-1",
      name: "Дом"
    });
    mockPrisma.workspaceInvitation.findMany.mockResolvedValue([
      {
        id: "invitation-1",
        email: "member@example.com",
        role: "EDITOR",
        expiresAt: new Date("2026-07-02T10:00:00.000Z"),
        createdAt: new Date("2026-06-25T10:00:00.000Z")
      }
    ]);
    mockPrisma.workspaceMember.findMany.mockResolvedValue([
      {
        id: "membership-1",
        role: "OWNER",
        joinedAt: new Date("2026-06-25T09:00:00.000Z"),
        user: {
          id: "owner-1",
          email: "owner@example.com",
          displayName: "Alice",
          firstName: null
        }
      }
    ]);

    const response = await app.inject({
      method: "GET",
      url: "/api/workspaces/workspace-1/invitations",
      headers: {
        authorization: `Bearer ${createToken(signToken, "owner-1")}`
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      workspace: {
        id: "workspace-1",
        name: "Дом"
      },
      invitations: [
        {
          id: "invitation-1",
          email: "member@example.com",
          role: "EDITOR",
          expiresAt: "2026-07-02T10:00:00.000Z",
          createdAt: "2026-06-25T10:00:00.000Z"
        }
      ],
      members: [
        {
          id: "membership-1",
          role: "OWNER",
          joinedAt: "2026-06-25T09:00:00.000Z",
          user: {
            id: "owner-1",
            email: "owner@example.com",
            displayName: "Alice",
            firstName: null
          }
        }
      ]
    });
    expect(mockPrisma.workspaceInvitation.findMany).toHaveBeenCalledWith({
      where: {
        workspaceId: "workspace-1",
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
    });

    await app.close();
  });

  it("lets a workspace owner revoke a pending invitation", async () => {
    const { buildServer } = await import("./server.js");
    const { signToken } = await import("./auth.js");
    const app = buildServer();

    mockPrisma.workspaceInvitation.findFirst.mockResolvedValue({
      id: "invitation-1",
      acceptedAt: null,
      revokedAt: null
    });
    mockPrisma.workspaceInvitation.update.mockResolvedValue({});

    const response = await app.inject({
      method: "POST",
      url: "/api/workspace-invitations/invitation-1/revoke",
      headers: {
        authorization: `Bearer ${createToken(signToken, "owner-1")}`
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      revoked: true
    });
    expect(mockPrisma.workspaceInvitation.findFirst).toHaveBeenCalledWith({
      where: {
        id: "invitation-1",
        workspace: {
          ownerId: "owner-1"
        }
      },
      select: {
        id: true,
        acceptedAt: true,
        revokedAt: true
      }
    });
    expect(mockPrisma.workspaceInvitation.update).toHaveBeenCalledWith({
      where: {
        id: "invitation-1"
      },
      data: {
        revokedAt: expect.any(Date)
      }
    });

    await app.close();
  });

  it("accepts a valid invitation for the signed-in user's verified email", async () => {
    const { buildServer } = await import("./server.js");
    const { signToken } = await import("./auth.js");
    const app = buildServer();
    const createdAt = new Date("2026-06-25T10:00:00.000Z");

    mockPrisma.user.findUnique.mockResolvedValue({
      id: "member-1",
      email: "member@example.com",
      emailVerifiedAt: new Date("2026-06-25T09:00:00.000Z")
    });
    mockTx.workspaceInvitation.findUnique.mockResolvedValue({
      id: "invitation-1",
      workspaceId: "workspace-1",
      email: "member@example.com",
      role: "EDITOR",
      expiresAt: new Date(Date.now() + 60_000),
      acceptedAt: null,
      revokedAt: null,
      createdAt
    });
    mockTx.workspaceInvitation.updateMany.mockResolvedValue({ count: 1 });
    mockTx.workspaceMember.upsert.mockResolvedValue({
      id: "membership-1",
      workspaceId: "workspace-1",
      userId: "member-1",
      role: "EDITOR",
      joinedAt: new Date("2026-06-25T11:00:00.000Z")
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/workspace-invitations/accept",
      headers: {
        authorization: `Bearer ${createToken(signToken, "member-1")}`
      },
      payload: {
        token: "raw-invitation-token"
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      accepted: true,
      member: {
        id: "membership-1",
        workspaceId: "workspace-1",
        userId: "member-1",
        role: "EDITOR",
        joinedAt: "2026-06-25T11:00:00.000Z"
      }
    });
    expect(mockTx.workspaceInvitation.updateMany).toHaveBeenCalledWith({
      where: {
        id: "invitation-1",
        acceptedAt: null,
        revokedAt: null
      },
      data: {
        acceptedAt: expect.any(Date)
      }
    });
    expect(mockTx.workspaceMember.upsert).toHaveBeenCalledWith({
      where: {
        workspaceId_userId: {
          workspaceId: "workspace-1",
          userId: "member-1"
        }
      },
      update: {
        role: "EDITOR",
        invitedEmail: "member@example.com",
        invitedAt: createdAt,
        joinedAt: expect.any(Date)
      },
      create: {
        workspaceId: "workspace-1",
        userId: "member-1",
        role: "EDITOR",
        invitedEmail: "member@example.com",
        invitedAt: createdAt,
        joinedAt: expect.any(Date)
      },
      select: {
        id: true,
        workspaceId: true,
        userId: true,
        role: true,
        joinedAt: true
      }
    });

    await app.close();
  });

  it("rejects an invitation for a different verified email", async () => {
    const { buildServer } = await import("./server.js");
    const { signToken } = await import("./auth.js");
    const app = buildServer();

    mockPrisma.user.findUnique.mockResolvedValue({
      id: "member-1",
      email: "member@example.com",
      emailVerifiedAt: new Date("2026-06-25T09:00:00.000Z")
    });
    mockTx.workspaceInvitation.findUnique.mockResolvedValue({
      id: "invitation-1",
      workspaceId: "workspace-1",
      email: "other@example.com",
      role: "EDITOR",
      expiresAt: new Date(Date.now() + 60_000),
      acceptedAt: null,
      revokedAt: null,
      createdAt: new Date("2026-06-25T10:00:00.000Z")
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/workspace-invitations/accept",
      headers: {
        authorization: `Bearer ${createToken(signToken, "member-1")}`
      },
      payload: {
        token: "raw-invitation-token"
      }
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe("INVITATION_EMAIL_MISMATCH");
    expect(mockTx.workspaceInvitation.updateMany).not.toHaveBeenCalled();
    expect(mockTx.workspaceMember.upsert).not.toHaveBeenCalled();

    await app.close();
  });
});

function createToken(signToken: typeof import("./auth.js").signToken, userId: string): string {
  return signToken(userId, {
    appBaseUrl: "http://localhost:3000",
    devAuthEnabled: false,
    emailFrom: undefined,
    emailProviderApiKey: undefined,
    jwtSecret: "test-secret",
    magicLinkTokenTtlMinutes: 15,
    nodeEnv: "test",
    googleClientId: undefined,
    googleClientSecret: undefined,
    googleRedirectUri: undefined,
    appleClientId: undefined,
    appleTeamId: undefined,
    appleKeyId: undefined,
    applePrivateKey: undefined,
    appleRedirectUri: undefined,
    port: 3001,
    telegramBotToken: undefined
  });
}
