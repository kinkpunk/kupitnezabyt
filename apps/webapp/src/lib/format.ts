import { ApiError } from "./api";

export function formatError(error: unknown): string {
  if (error instanceof ApiError) {
    return getFriendlyErrorMessage(error.message);
  }

  if (error instanceof Error) {
    return getFriendlyErrorMessage(error.message);
  }

  return "Что-то пошло не так.";
}

function getFriendlyErrorMessage(message: string): string {
  const authErrorMessages: Record<string, string> = {
    EMAIL_AUTH_REQUIRED: "Войдите через Google или получите ссылку на email.",
    "Failed to fetch": "Не удалось подключиться к сервису. Попробуйте обновить страницу.",
    "Load failed": "Не удалось подключиться к сервису. Попробуйте еще раз.",
    NETWORK_ERROR: "Не удалось подключиться к сервису. Попробуйте еще раз.",
    GOOGLE_AUTH_CANCELLED: "Вход через Google отменен.",
    GOOGLE_AUTH_FAILED: "Не удалось завершить вход через Google. Попробуйте еще раз.",
    GOOGLE_AUTH_INVALID_CALLBACK: "Google вернул неполный ответ. Попробуйте войти еще раз.",
    GOOGLE_AUTH_INVALID_STATE: "Сессия входа устарела. Начните вход через Google заново.",
    GOOGLE_AUTH_INVALID_TOKEN: "Не удалось проверить Google-аккаунт. Попробуйте еще раз.",
    GOOGLE_AUTH_NOT_CONFIGURED: "Вход через Google временно недоступен. Используйте email-ссылку.",
    APPLE_AUTH_CANCELLED: "Вход через Apple отменен.",
    APPLE_AUTH_FAILED: "Не удалось завершить вход через Apple. Попробуйте еще раз.",
    APPLE_AUTH_INVALID_CALLBACK: "Apple вернул неполный ответ. Попробуйте войти еще раз.",
    APPLE_AUTH_INVALID_STATE: "Сессия входа устарела. Начните вход через Apple заново.",
    APPLE_AUTH_INVALID_TOKEN: "Не удалось проверить Apple ID. Попробуйте еще раз.",
    APPLE_AUTH_NOT_CONFIGURED: "Вход через Apple временно недоступен. Используйте email-ссылку.",
    EMAIL_VERIFICATION_REQUIRED: "Войдите через email, на который пришло приглашение.",
    HTTP_404: "Данные не найдены. Обновите страницу и попробуйте еще раз.",
    NOT_FOUND: "Данные не найдены. Обновите страницу и попробуйте еще раз.",
    INVALID_INVITATION: "Приглашение недействительно или устарело.",
    INVITATION_EMAIL_MISMATCH: "Это приглашение отправлено на другой email.",
    INVITEE_NOT_FOUND:
      "Пользователь с таким email пока не найден. Сейчас можно приглашать только тех, кто уже входил в сервис.",
    EMPTY_CHECK_CATEGORY: "В этой категории пока нечего проверять.",
    EMPTY_CHECK_GROUP: "В этом наборе пока нечего проверять.",
    MEMBER_NOT_FOUND: "Участник не найден. Обновите список и попробуйте еще раз.",
    WORKSPACE_NOT_FOUND: "Список не найден или доступ к нему уже закрыт.",
    OWNED_SHARED_WORKSPACE_REQUIRES_TRANSFER:
      "Перед удалением аккаунта передайте владение общим списком или удалите участников."
  };

  return authErrorMessages[message] ?? message;
}

export function formatDate(value: string | null): string {
  if (!value) {
    return "Дата не задана";
  }

  return new Intl.DateTimeFormat("ru", {
    day: "2-digit",
    month: "short"
  }).format(new Date(value));
}

export function calculateSnoozedAt(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

