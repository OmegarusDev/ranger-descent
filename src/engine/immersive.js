/**
 * Installed mobile app (WebAPK / home-screen) only.
 * Desktop browsers never request the Fullscreen API.
 */

export function isStandaloneDisplay() {
  return (
    window.matchMedia("(display-mode: fullscreen)").matches ||
    window.matchMedia("(display-mode: standalone)").matches ||
    (typeof navigator !== "undefined" && navigator.standalone === true)
  );
}

function isMobileShell() {
  const ua = navigator.userAgent || "";
  if (/Android|iPhone|iPad|iPod/i.test(ua)) return true;
  return window.matchMedia("(pointer: coarse)").matches
    && !window.matchMedia("(hover: hover)").matches;
}

function lockPortrait() {
  try {
    const lock = screen.orientation?.lock?.("portrait");
    if (lock && typeof lock.catch === "function") lock.catch(() => {});
  } catch {
    /* not allowed outside an installed mobile app */
  }
}

/** Portrait lock for the mobile WebAPK. No-op on desktop. */
export function lockMobileAppPortrait() {
  if (!isStandaloneDisplay() || !isMobileShell()) return;
  lockPortrait();
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") lockPortrait();
  });
}
