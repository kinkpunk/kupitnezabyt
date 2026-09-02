"use client";

import React from "react";

export function ErrorNotice({
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
    <div className="notice" role="alert">
      <span>{message}</span>
      <button
        className="notice-close"
        type="button"
        aria-label="Закрыть ошибку"
        onClick={onClose}
      >
        Закрыть
      </button>
    </div>
  );
}
