import type { ItemStatus } from "@kupitnezabyt/shared";

import type {
  AuthResponse,
  Category,
  CheckSession,
  DeleteResponse,
  DeletedCountResponse,
  Item,
  ShoppingListEntry
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
  const savedToken = window.localStorage.getItem(tokenStorageKey);
  if (savedToken) {
    prepareTelegramWebApp();
    return savedToken;
  }

  prepareTelegramWebApp();

  const initData = window.Telegram?.WebApp?.initData;
  const response = initData
    ? await post<AuthResponse>("/api/auth/telegram", undefined, { initData })
    : await post<AuthResponse>("/api/auth/dev", undefined, {
        telegramUserId: "local",
        firstName: "Dev"
      });

  window.localStorage.setItem(tokenStorageKey, response.token);
  return response.token;
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

export function createCategory(token: string, name: string): Promise<Category> {
  return post<Category>("/api/categories", token, { name });
}

export function archiveCategory(token: string, categoryId: string): Promise<Category> {
  return post<Category>(`/api/categories/${categoryId}/archive`, token, {});
}

export function getItems(token: string): Promise<Item[]> {
  return get<Item[]>("/api/items", token);
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
    name: string;
  }
): Promise<Item> {
  return patch<Item>(`/api/items/${itemId}`, token, input);
}

export function archiveItem(token: string, itemId: string): Promise<Item> {
  return post<Item>(`/api/items/${itemId}/archive`, token, {});
}

export function setItemStatus(
  token: string,
  itemId: string,
  status: ItemStatus
): Promise<Item> {
  return post<Item>(`/api/items/${itemId}/status`, token, { status });
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

export function startCategoryCheckSession(
  token: string,
  categoryId: string
): Promise<CheckSession> {
  return post<CheckSession>(`/api/check/category/${categoryId}/start`, token, {});
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
  const headers: Record<string, string> = {
    "Content-Type": "application/json"
  };

  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }

  const init: RequestInit = {
    method: options.method,
    headers
  };

  if (options.body !== undefined) {
    init.body = JSON.stringify(options.body);
  }

  const response = await fetch(`${apiBaseUrl}${path}`, init);

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
