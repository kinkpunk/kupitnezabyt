import React from "react";

export interface BadgeProps {
  count: number;
}

export function Badge({ count }: BadgeProps) {
  if (count <= 0) {
    return null;
  }

  const label = count > 99 ? "99+" : String(count);

  return (
    <span aria-label={`${count} уведомлений`} className="ds-badge">
      {label}
    </span>
  );
}
