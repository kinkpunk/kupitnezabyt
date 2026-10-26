"use client";

import React, { useEffect, useRef } from "react";

export const TOAST_DURATION_MS = 3500;

export function ToastNotice({
  message,
  actionLabel,
  onAction,
  onClose
}: {
  message: string | null;
  actionLabel?: string | undefined;
  onAction?: (() => void) | undefined;
  onClose: () => void;
}) {
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!message) {
      return;
    }

    const timeoutId = window.setTimeout(() => onCloseRef.current(), TOAST_DURATION_MS);
    return () => window.clearTimeout(timeoutId);
  }, [message]);

  if (!message) {
    return null;
  }

  function handleAction() {
    onAction?.();
    onClose();
  }

  return (
    <div className="toast-notice">
      <span className="toast-notice__message" role="status">{message}</span>
      {actionLabel && onAction ? (
        <button type="button" className="toast-notice__action" onClick={handleAction}>
          {actionLabel}
        </button>
      ) : null}
      <button type="button" className="toast-notice__close" onClick={onClose}>
        Закрыть
      </button>
    </div>
  );
}
