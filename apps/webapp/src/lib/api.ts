import type { ItemStatus } from "@kupitnezabyt/shared";

import type {
  AuthResponse,
  Category,
  CheckSession,
  DeleteResponse,
  DeletedCountResponse,
  InAppReminder,
  ItemGroup,
  Item,
  MagicLinkRequestResponse,
  OAuthStartResponse,
  RecommendationSuggestion,
  ShoppingListEntry,
  UserDataExport
} from "./types";

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData?: string;
        themeParams?: TelegramThemeParams;
        ready?: () => void;
        expand?: () => void;
      };
    };
  }
}

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";
const tokenStorageKey = "kupitnezabyt.token";

type TelegramThemeParams = {
  bg_color?: string;
  button_color?: string;
  hint_color?: string;
  secondary_bg_color?: string;
  text_color?: string;
};

export class ApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApiError";
  }
}

export async function login(): Promise<string> {
  prepareTelegramWebApp();

  const searchParams = new URLSearchParams(window.location.search);
  const magicToken = searchParams.get("magic_token");
  const oauthToken = searchParams.get("oauth_token");
  const oauthError = searchParams.get("oauth_error");

  if (oauthToken) {
    window.localStorage.setItem(tokenStorageKey, oauthToken);
    window.history.replaceState({}, "", window.location.pathname);
    return oauthToken;
  }

  if (oauthError) {
    window.history.replaceState({}, "", window.location.pathname);
    throw new ApiError(oauthError);
  }

  if (magicToken) {
    const response = await post<AuthResponse>("/api/auth/email/verify", undefined, {
      token: magicToken
    });
    window.localStorage.setItem(tokenStorageKey, response.token);
    window.history.replaceState({}, "", window.location.pathname);
    return response.token;
  }

  const savedToken = window.localStorage.getItem(tokenStorageKey);
  if (savedToken) {
    return savedToken;
  }

  const initData = window.Telegram?.WebApp?.initData;
  if (initData) {
    const response = await post<AuthResponse>("/api/auth/telegram", undefined, { initData });
    window.localStorage.setItem(tokenStorageKey, response.token);
    return response.token;
  }

  if (process.env.NODE_ENV === "development") {
    const response = await post<AuthResponse>("/api/auth/dev", undefined, {
      telegramUserId: "local",
      firstName: "Dev"
    });
    window.localStorage.setItem(tokenStorageKey, response.token);
    return response.token;
  }

  throw new ApiError("EMAIL_AUTH_REQUIRED");
}

export function clearSavedToken(): void {
  window.localStorage.removeItem(tokenStorageKey);
}

export function requestMagicLink(email: string): Promise<MagicLinkRequestResponse> {
  return post<MagicLinkRequestResponse>("/api/auth/email/request", undefined, { email });
}

export function startGoogleSignIn(): Promise<OAuthStartResponse> {
  return post<OAuthStartResponse>("/api/auth/google/start", undefined, {});
}

export function startAppleSignIn(): Promise<OAuthStartResponse> {
  return post<OAuthStartResponse>("/api/auth/apple/start", undefined, {});
}

function prepareTelegramWebApp(): void {
  const webApp = window.Telegram?.WebApp;
  webApp?.ready?.();
  webApp?.expand?.();
  applyTelegramTheme(webApp?.themeParams);
}

function applyTelegramTheme(themeParams: TelegramThemeParams | undefined): void {
  if (!themeParams) {
    return;
  }

  const root = document.documentElement;
  setCssVariable(root, "--background", themeParams.bg_color);
  setCssVariable(root, "--surface", themeParams.secondary_bg_color);
  setCssVariable(root, "--surface-strong", themeParams.secondary_bg_color);
  setCssVariable(root, "--text", themeParams.text_color);
  setCssVariable(root, "--muted", themeParams.hint_color);
  setCssVariable(root, "--accent", themeParams.button_color);
}

function setCssVariable(root: HTMLElement, name: string, value: string | undefined): void {
  if (value) {
    root.style.setProperty(name, value);
  }
}

export function getCategories(token: string): Promise<Category[]> {
  return get<Category[]>("/api/categories", token);
}

export function getArchivedCategories(token: string): Promise<Category[]> {
  return get<Category[]>("/api/categories?archived=true", token);
}

export function createCategory(token: string, name: string): Promise<Category> {
  return post<Category>("/api/categories", token, { name });
}

export function archiveCategory(token: string, categoryId: string): Promise<Category> {
  return post<Category>(`/api/categories/${categoryId}/archive`, token, {});
}

export function updateCategory(
  token: string,
  categoryId: string,
  input: {
    name?: string;
    usageCycleDays?: number | null;
    nextCheckAt?: string | null;
    reminderEnabled?: boolean;
  }
): Promise<Category> {
  return patch<Category>(`/api/categories/${categoryId}`, token, input);
}

export function restoreCategory(token: string, categoryId: string): Promise<Category> {
  return post<Category>(`/api/categories/${categoryId}/restore`, token, {});
}

export function deleteArchivedCategory(token: string, categoryId: string): Promise<DeleteResponse> {
  return del<DeleteResponse>(`/api/categories/${categoryId}`, token);
}

export function getItems(token: string): Promise<Item[]> {
  return get<Item[]>("/api/items", token);
}

export function getArchivedItems(token: string): Promise<Item[]> {
  return get<Item[]>("/api/items?archived=true", token);
}

export function searchItems(token: string, query: string): Promise<Item[]> {
  return get<Item[]>(`/api/items/search?q=${encodeURIComponent(query)}`, token);
}

export function createItem(
  token: string,
  input: {
    categoryId: string;
    name: string;
  }
): Promise<Item> {
  return post<Item>("/api/items", token, input);
}

export function updateItem(
  token: string,
  itemId: string,
  input: {
    name?: string;
    categoryId?: string;
    brand?: string | null;
    notes?: string | null;
    usageCycleDays?: number | null;
    nextCheckAt?: string | null;
    reminderEnabled?: boolean;
  }
): Promise<Item> {
  return patch<Item>(`/api/items/${itemId}`, token, input);
}

export function getInAppReminders(token: string): Promise<InAppReminder[]> {
  return get<InAppReminder[]>("/api/reminders/in-app", token);
}

export function archiveItem(token: string, itemId: string): Promise<Item> {
  return post<Item>(`/api/items/${itemId}/archive`, token, {});
}

export function restoreItem(token: string, itemId: string): Promise<Item> {
  return post<Item>(`/api/items/${itemId}/restore`, token, {});
}

export function deleteArchivedItem(token: string, itemId: string): Promise<DeleteResponse> {
  return del<DeleteResponse>(`/api/items/${itemId}`, token);
}

export function setItemStatus(
  token: string,
  itemId: string,
  status: ItemStatus
): Promise<Item> {
  return post<Item>(`/api/items/${itemId}/status`, token, { status });
}

export function snoozeItemReminder(
  token: string,
  itemId: string,
  days: number
): Promise<Item> {
  return post<Item>(`/api/items/${itemId}/snooze`, token, { days });
}

export function getRecommendations(
  token: string,
  itemId: string
): Promise<RecommendationSuggestion[]> {
  return get<RecommendationSuggestion[]>(
    `/api/recommendations?itemId=${encodeURIComponent(itemId)}`,
    token
  );
}

export function acceptRecommendation(
  token: string,
  recommendationId: string,
  categoryId?: string
): Promise<Item> {
  return post<Item>(`/api/recommendations/${recommendationId}/accept`, token, {
    categoryId
  });
}

export function dismissRecommendation(
  token: string,
  recommendationId: string
): Promise<{ dismissed: boolean }> {
  return post<{ dismissed: boolean }>(
    `/api/recommendations/${recommendationId}/dismiss`,
    token,
    {}
  );
}

export function getShoppingList(token: string): Promise<ShoppingListEntry[]> {
  return get<ShoppingListEntry[]>("/api/shopping-list", token);
}

export function createShoppingListItem(
  token: string,
  input: {
    title: string;
    categoryId?: string | null;
    priority?: "NORMAL" | "URGENT";
  }
): Promise<ShoppingListEntry> {
  return post<ShoppingListEntry>("/api/shopping-list", token, input);
}

export function updateShoppingListItem(
  token: string,
  shoppingListItemId: string,
  input: {
    title: string;
    categoryId?: string | null;
    priority?: "NORMAL" | "URGENT";
  }
): Promise<ShoppingListEntry> {
  return patch<ShoppingListEntry>(`/api/shopping-list/${shoppingListItemId}`, token, input);
}

export function completeShoppingListItem(
  token: string,
  shoppingListItemId: string
): Promise<ShoppingListEntry> {
  return post<ShoppingListEntry>(`/api/shopping-list/${shoppingListItemId}/complete`, token, {});
}

export function deleteShoppingListItem(
  token: string,
  shoppingListItemId: string
): Promise<DeleteResponse> {
  return del<DeleteResponse>(`/api/shopping-list/${shoppingListItemId}`, token);
}

export function clearCompletedShoppingList(token: string): Promise<DeletedCountResponse> {
  return del<DeletedCountResponse>("/api/shopping-list/completed", token);
}

export function getGroups(token: string): Promise<ItemGroup[]> {
  return get<ItemGroup[]>("/api/groups", token);
}

export function createGroup(token: string, name: string): Promise<ItemGroup> {
  return post<ItemGroup>("/api/groups", token, { name });
}

export function archiveGroup(token: string, groupId: string): Promise<ItemGroup> {
  return post<ItemGroup>(`/api/groups/${groupId}/archive`, token, {});
}

export function updateGroup(
  token: string,
  groupId: string,
  input: {
    name?: string;
    usageCycleDays?: number | null;
    nextCheckAt?: string | null;
    reminderEnabled?: boolean;
  }
): Promise<ItemGroup> {
  return patch<ItemGroup>(`/api/groups/${groupId}`, token, input);
}

export function addGroupItem(
  token: string,
  groupId: string,
  itemId: string
): Promise<ItemGroup> {
  return post<ItemGroup>(`/api/groups/${groupId}/items`, token, { itemId });
}

export function removeGroupItem(
  token: string,
  groupId: string,
  itemId: string
): Promise<ItemGroup> {
  return del<ItemGroup>(`/api/groups/${groupId}/items/${itemId}`, token);
}

export function startCategoryCheckSession(
  token: string,
  categoryId: string
): Promise<CheckSession> {
  return post<CheckSession>(`/api/check/category/${categoryId}/start`, token, {});
}

export function startGroupCheckSession(token: string, groupId: string): Promise<CheckSession> {
  return post<CheckSession>(`/api/check/group/${groupId}/start`, token, {});
}

export function getActiveCheckSession(token: string): Promise<CheckSession | null> {
  return get<CheckSession | null>("/api/check/session/active", token);
}

export function setCheckSessionItemStatus(
  token: string,
  sessionId: string,
  itemId: string,
  status: ItemStatus
): Promise<CheckSession> {
  return post<CheckSession>(`/api/check/session/${sessionId}/item/${itemId}/status`, token, {
    status
  });
}

export function completeCheckSession(token: string, sessionId: string): Promise<CheckSession> {
  return post<CheckSession>(`/api/check/session/${sessionId}/complete`, token, {});
}

export function cancelCheckSession(token: string, sessionId: string): Promise<CheckSession> {
  return post<CheckSession>(`/api/check/session/${sessionId}/cancel`, token, {});
}

export function exportUserData(token: string): Promise<UserDataExport> {
  return get<UserDataExport>("/api/export/json", token);
}

export function deleteAccount(token: string): Promise<DeleteResponse> {
  return del<DeleteResponse>("/api/me", token);
}

async function get<TResponse>(path: string, token: string): Promise<TResponse> {
  return request<TResponse>(path, {
    method: "GET",
    token,
    body: undefined
  });
}

async function post<TResponse>(
  path: string,
  token: string | undefined,
  body: unknown
): Promise<TResponse> {
  return request<TResponse>(path, {
    method: "POST",
    token,
    body
  });
}

async function patch<TResponse>(
  path: string,
  token: string,
  body: unknown
): Promise<TResponse> {
  return request<TResponse>(path, {
    method: "PATCH",
    token,
    body
  });
}

async function del<TResponse>(path: string, token: string): Promise<TResponse> {
  return request<TResponse>(path, {
    method: "DELETE",
    token,
    body: undefined
  });
}

async function request<TResponse>(
  path: string,
  options: {
    method: "DELETE" | "GET" | "PATCH" | "POST";
    token: string | undefined;
    body: unknown | undefined;
  }
): Promise<TResponse> {
  const headers: Record<string, string> = {};

  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }

  const init: RequestInit = {
    method: options.method,
    headers
  };

  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(options.body);
  }

  const response = await fetch(`${apiBaseUrl}${path}`, init).catch(() => {
    throw new ApiError("NETWORK_ERROR");
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { error?: string | { code?: string; message?: string } }
      | null;
    const errorMessage =
      typeof payload?.error === "string"
        ? payload.error
        : payload?.error?.message ?? payload?.error?.code;
    throw new ApiError(errorMessage ?? `HTTP_${response.status}`);
  }

  return (await response.json()) as TResponse;
}
