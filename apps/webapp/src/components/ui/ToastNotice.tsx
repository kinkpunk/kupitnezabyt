"use client";

export function ToastNotice({
  message,
  onClose
}: {
  message: string | null;
  onClose: () => void;
}) {
  if (!message) {
    return null;
  }

  return (
    <div className="toast-notice" role="status">
      <span>{message}</span>
      {/* TODO: Add undo once purchase completion has a rollback path. */}
      <button type="button" aria-label="Закрыть уведомление" onClick={onClose}>
        Закрыть
      </button>
    </div>
  );
}
