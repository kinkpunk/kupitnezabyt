import { describe, expect, it, vi } from "vitest";

import {
  ensurePersonalWorkspace,
  getPersonalWorkspaceId,
  getPersonalWorkspaceMemberId
} from "./workspaces.js";

describe("workspace helpers", () => {
  it("builds deterministic personal workspace identifiers", () => {
    expect(getPersonalWorkspaceId("user-1")).toBe("workspace_user-1");
    expect(getPersonalWorkspaceMemberId("user-1")).toBe("workspace_member_user-1");
  });

  it("ensures a personal workspace and owner membership", async () => {
    const now = new Date("2026-06-25T12:00:00.000Z");
    const workspace = {
      id: "workspace_user-1",
      ownerId: "user-1",
      name: "Alice"
    };
    const client = {
      workspace: {
        upsert: vi.fn().mockResolvedValue(workspace)
      },
      workspaceMember: {
        upsert: vi.fn().mockResolvedValue({})
      }
    };

    await expect(
      ensurePersonalWorkspace(client as never, {
        userId: "user-1",
        name: " Alice ",
        now
      })
    ).resolves.toBe(workspace);

    expect(client.workspace.upsert).toHaveBeenCalledWith({
      where: {
        id: "workspace_user-1"
      },
      update: {},
      create: {
        id: "workspace_user-1",
        ownerId: "user-1",
        name: "Alice",
        createdAt: now,
        updatedAt: now
      }
    });
    expect(client.workspaceMember.upsert).toHaveBeenCalledWith({
      where: {
        workspaceId_userId: {
          workspaceId: "workspace_user-1",
          userId: "user-1"
        }
      },
      update: {
        role: "OWNER",
        joinedAt: now
      },
      create: {
        id: "workspace_member_user-1",
        workspaceId: "workspace_user-1",
        userId: "user-1",
        role: "OWNER",
        joinedAt: now,
        createdAt: now,
        updatedAt: now
      }
    });
  });
});
