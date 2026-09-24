import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ApiError,
  buildLegalConsent,
  completeOnboarding,
  consumeInvitationAcceptedToast,
  getActiveWorkspaceId,
  getCategorySortMode,
  getStoredLegalConsent,
  login,
  saveStoredLegalConsent,
  setCategorySortMode,
  stagePendingLoginConsent
} from "./api";

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
    vi.stubEnv("NODE_ENV", "test");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
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

    await expect(login()).resolves.toEqual({ token: "session-token", consentRecorded: null });

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
    expect(consumeInvitationAcceptedToast()).toBe(true);
    expect(consumeInvitationAcceptedToast()).toBe(false);
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

describe("legal consent storage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("returns null when no consent is stored or the versions are outdated", () => {
    const { localStorage } = stubWindow("");
    expect(getStoredLegalConsent()).toBeNull();

    localStorage.getItem.mockReturnValue(
      JSON.stringify({ termsVersion: "0.9.0", privacyVersion: "1.0.0", acceptedAt: "2026-09-23T10:00:00.000Z" })
    );
    expect(getStoredLegalConsent()).toBeNull();
  });

  it("round-trips a consent accepted for the current document versions", () => {
    stubWindow("");
    const consent = buildLegalConsent();
    saveStoredLegalConsent(consent);
    expect(getStoredLegalConsent()).toEqual(consent);
  });

  it("sends staged consent to the Telegram auth request and clears it", async () => {
    const { localStorage } = stubWindow("");
    vi.stubGlobal("window", {
      ...window,
      Telegram: {
        WebApp: {
          initData: "telegram-init-data"
        }
      }
    });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        token: "telegram-session-token",
        consentRecorded: true
      })
    });
    vi.stubGlobal("fetch", fetchMock);

    stagePendingLoginConsent(buildLegalConsent());
    await expect(login()).resolves.toEqual({
      token: "telegram-session-token",
      consentRecorded: true
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3001/api/auth/telegram",
      expect.objectContaining({
        body: expect.stringContaining('"initData":"telegram-init-data"'),
        method: "POST"
      })
    );
    const requestInit = fetchMock.mock.calls[0]?.[1];
    const body = JSON.parse((requestInit?.body as string | undefined) ?? "{}");
    expect(body.consent.termsVersion).toBe("1.0.0");
    expect(body.consent.privacyVersion).toBe("1.0.0");
    expect(typeof body.consent.acceptedAt).toBe("string");
    expect(localStorage.removeItem).toHaveBeenCalledWith("kupitnezabyt.pendingConsent");
  });

  it("blocks silent Telegram sign-in until consent is given", async () => {
    stubWindow("");
    vi.stubGlobal("window", {
      ...window,
      Telegram: {
        WebApp: {
          initData: "telegram-init-data"
        }
      }
    });

    await expect(login()).rejects.toEqual(new ApiError("LEGAL_CONSENT_REQUIRED"));
  });

  it("attaches stored pending consent when verifying a magic link", async () => {
    const { localStorage } = stubWindow("?magic_token=raw-magic-token");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        token: "email-session-token",
        consentRecorded: true
      })
    });
    vi.stubGlobal("fetch", fetchMock);

    stagePendingLoginConsent(buildLegalConsent());
    await expect(login()).resolves.toEqual({
      token: "email-session-token",
      consentRecorded: true
    });

    const requestInit = fetchMock.mock.calls[0]?.[1];
    const body = JSON.parse((requestInit?.body as string | undefined) ?? "{}");
    expect(body.token).toBe("raw-magic-token");
    expect(body.consent.termsVersion).toBe("1.0.0");
    expect(localStorage.removeItem).toHaveBeenCalledWith("kupitnezabyt.pendingConsent");
  });
});

describe("category sort mode", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("defaults to status sort when no preference is saved", () => {
    const { localStorage } = stubWindow("");
    expect(getCategorySortMode()).toBe("status");
    expect(localStorage.getItem).toHaveBeenCalledWith(
      "kupitnezabyt.categorySortMode"
    );
  });

  it("preserves manual sort when it was explicitly selected", () => {
    const { localStorage } = stubWindow("");
    localStorage.getItem.mockReturnValue("manual");
    expect(getCategorySortMode()).toBe("manual");
  });

  it("saves selected sort mode to localStorage", () => {
    const { localStorage } = stubWindow("");
    setCategorySortMode("manual");
    expect(localStorage.setItem).toHaveBeenCalledWith(
      "kupitnezabyt.categorySortMode",
      "manual"
    );
  });
});
