type AppHeightInput = {
  standalone: boolean;
  isAppleMobile: boolean;
  screenHeight: number;
  screenWidth: number;
  innerWidth: number;
  innerHeight: number;
};

/**
 * iOS standalone WebView reports viewport height (dvh/innerHeight) without the
 * top safe-area inset while env(safe-area-inset-top) stays positive, which
 * leaves dead space at the bottom of a full-height shell. Full screen metrics
 * are reliable there, so the shell height is overridden with them. Returns
 * null when the override does not apply and the CSS fallback should be used.
 */
export function resolveAppHeight({
  standalone,
  isAppleMobile,
  screenHeight,
  screenWidth,
  innerWidth,
  innerHeight
}: AppHeightInput): number | null {
  if (!standalone || !isAppleMobile || screenHeight <= 0 || screenWidth <= 0) {
    return null;
  }

  const portrait = innerHeight >= innerWidth;
  const fullScreenHeight = portrait
    ? Math.max(screenHeight, screenWidth)
    : Math.min(screenHeight, screenWidth);

  return Math.max(innerHeight, fullScreenHeight);
}
