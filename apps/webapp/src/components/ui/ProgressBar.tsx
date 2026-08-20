import React from "react";

export interface ProgressBarProps {
  done: number;
  total: number;
}

export function ProgressBar({ done, total }: ProgressBarProps) {
  const safeTotal = Math.max(0, total);
  const safeDone = Math.max(0, Math.min(done, safeTotal));
  const percent = safeTotal > 0 ? (safeDone / safeTotal) * 100 : 0;

  return (
    <div
      aria-label={`Прогресс: ${safeDone} из ${safeTotal}`}
      aria-valuemax={safeTotal}
      aria-valuemin={0}
      aria-valuenow={safeDone}
      className="ds-progress-bar"
      role="progressbar"
    >
      <div className="ds-progress-bar__fill" style={{ width: `${percent}%` }} />
    </div>
  );
}
