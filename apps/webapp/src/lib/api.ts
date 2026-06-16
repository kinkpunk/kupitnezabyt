import type { ItemStatus } from "@kupitnezabyt/shared";

import type { AuthResponse, Category, Item, ShoppingListEntry } from "./types";

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData?: string;
        ready?: () => void;
        expand?: () => void;
      };
    };
  }
}

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";
const tokenStorageKey = "kupitnezabyt.token";

export class ApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApiError";
  }
}

export async function login(): Promise<string> {
  const savedToken = window.localStorage.getItem(tokenStorageKey);
  if (savedToken) {
    return savedToken;
  }

  window.Telegram?.WebApp?.ready?.();
  window.Telegram?.WebApp?.expand?.();

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

export function getCategories(token: string): Promise<Category[]> {
  return get<Category[]>("/api/categories", token);
}

export function createCategory(token: string, name: string): Promise<Category> {
  return post<Category>("/api/categories", token, { name });
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

export function completeShoppingListItem(
  token: string,
  shoppingListItemId: string
): Promise<ShoppingListEntry> {
  return post<ShoppingListEntry>(`/api/shopping-list/${shoppingListItemId}/complete`, token, {});
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

async function request<TResponse>(
  path: string,
  options: {
    method: "GET" | "POST";
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
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new ApiError(payload?.error ?? `HTTP_${response.status}`);
  }

  return (await response.json()) as TResponse;
}
