export function hapticImpactLight(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.Telegram?.WebApp?.HapticFeedback?.impactOccurred?.("light");
}

export function hapticNotificationSuccess(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred?.("success");
}
