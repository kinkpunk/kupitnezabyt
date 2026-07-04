import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError, completeOnboarding, getActiveWorkspaceId, login } from "./api";

function createLocalStorageMock() {
  const values = new Map<string, string>();

  return {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    removeItem: vi.fn((key: string) => {
      values.delete(key);
    }),
    setItem: vi.fn((key: string, value: string) => {
      values.set(key, value);
    })
  };
}

function stubWindow(search: string, localStorage = createLocalStorageMock()) {
  const history = {
    replaceState: vi.fn()
  };

  vi.stubGlobal("window", {
    Telegram: undefined,
    history,
    localStorage,
    location: {
      pathname: "/",
      search
    }
  });

  return {
    history,
    localStorage
  };
}

describe("webapp api auth", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("keeps a workspace invitation while the user signs in through OAuth", async () => {
    const { localStorage } = stubWindow("?workspace_invite_token=invite-token");

    await expect(login()).rejects.toEqual(new ApiError("EMAIL_AUTH_REQUIRED"));
    expect(localStorage.setItem).toHaveBeenCalledWith(
      "kupitnezabyt.pendingWorkspaceInvitationToken",
      "invite-token"
    );

    const { history } = stubWindow("?oauth_token=session-token", localStorage);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        accepted: true,
        member: {
          id: "membership-1",
          workspaceId: "workspace-shared",
          userId: "user-1",
          role: "EDITOR",
          joinedAt: "2026-06-30T10:00:00.000Z"
        }
      })
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(login()).resolves.toBe("session-token");

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3001/api/workspace-invitations/accept",
      expect.objectContaining({
        body: JSON.stringify({
          token: "invite-token"
        }),
        method: "POST"
      })
    );
    expect(getActiveWorkspaceId()).toBe("workspace-shared");
    expect(localStorage.removeItem).toHaveBeenCalledWith(
      "kupitnezabyt.pendingWorkspaceInvitationToken"
    );
    expect(history.replaceState).toHaveBeenCalledWith({}, "", "/");
  });

  it("marks onboarding completed on the API", async () => {
    stubWindow("");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        id: "user-1",
        onboardingCompletedAt: "2026-07-04T12:00:00.000Z"
      })
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(completeOnboarding("session-token")).resolves.toEqual({
      id: "user-1",
      onboardingCompletedAt: "2026-07-04T12:00:00.000Z"
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3001/api/me/onboarding",
      expect.objectContaining({
        body: JSON.stringify({}),
        method: "PATCH"
      })
    );
  });
});
