"use client";

import { WifiOff } from "lucide-react";
import React from "react";

export function OfflineBanner() {
  return (
    <div className="ds-offline-banner" role="status">
      <WifiOff aria-hidden="true" size={14} />
      Нет сети — изменения могут не сохраниться
    </div>
  );
}
