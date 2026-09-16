/**
 * Installed mobile app (WebAPK / home-screen) only.
 * Desktop browsers and ordinary mobile tabs never auto-request the Fullscreen API.
 */

const PREF_KEY = "ranger-descent-fullscreen";

export function isStandaloneDisplay() {
  return (
    window.matchMedia("(display-mode: fullscreen)").matches ||
    window.matchMedia("(display-mode: standalone)").matches ||
    (typeof navigator !== "undefined" && navigator.standalone === true)
  );
}

export function isMobileShell() {
  const ua = navigator.userAgent || "";
  if (/Android|iPhone|iPad|iPod/i.test(ua)) return true;
  return window.matchMedia("(pointer: coarse)").matches
    && !window.matchMedia("(hover: hover)").matches;
}

export function isMobileAppShell() {
  return isStandaloneDisplay() && isMobileShell();
}

export function canUseFullscreenApi() {
  const el = document.documentElement;
  return !!(el.requestFullscreen || el.webkitRequestFullscreen);
}

export function isFullscreenNow() {
  return !!(document.fullscreenElement || document.webkitFullscreenElement);
}

export function getFullscreenPref() {
  try {
    const v = localStorage.getItem(PREF_KEY);
    if (v === "0") return false;
    if (v === "1") return true;
  } catch {
    /* private mode */
  }
  return isMobileAppShell();
}

export function setFullscreenPref(on) {
  try { localStorage.setItem(PREF_KEY, on ? "1" : "0"); } catch {
    /* ignore */
  }
}

function shouldAutoFullscreen() {
  return isMobileAppShell() && getFullscreenPref();
}

export async function enterFullscreen() {
  if (!canUseFullscreenApi() || isFullscreenNow()) return isFullscreenNow();
  const el = document.documentElement;
  try {
    if (el.requestFullscreen) {
      try {
        await el.requestFullscreen({ navigationUI: "hide" });
      } catch {
        await el.requestFullscreen();
      }
    } else {
      el.webkitRequestFullscreen();
    }
    return true;
  } catch {
    return false;
  }
}

export async function exitFullscreen() {
  try {
    if (document.exitFullscreen) await document.exitFullscreen();
    else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
  } catch {
    /* already left */
  }
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
  if (!isMobileAppShell()) return;
  lockPortrait();
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") lockPortrait();
  });
}

function syncFullscreenClass() {
  document.documentElement.classList.toggle("immersive", isFullscreenNow() || isMobileAppShell());
}

/** Pin layout to the visual viewport so tall/phone chrome can't letterbox the hub. */
export function syncAppViewport() {
  const vv = window.visualViewport;
  const h = Math.max(1, Math.round(vv?.height || window.innerHeight || 0));
  const w = Math.max(1, Math.round(vv?.width || window.innerWidth || 0));
  const root = document.documentElement;
  root.style.setProperty("--app-h", `${h}px`);
  root.style.setProperty("--app-w", `${w}px`);
}

function bindAppViewport() {
  syncAppViewport();
  window.addEventListener("resize", syncAppViewport);
  window.visualViewport?.addEventListener("resize", syncAppViewport);
  window.visualViewport?.addEventListener("scroll", syncAppViewport);
}

/** Auto immersive chrome for the installed Android/iOS app only. */
export function initImmersive() {
  bindAppViewport();
  document.documentElement.classList.toggle("app-shell", isMobileAppShell());
  lockMobileAppPortrait();
  syncFullscreenClass();
  const tryEnter = () => {
    if (shouldAutoFullscreen()) enterFullscreen().then(syncFullscreenClass);
  };
  tryEnter();
  document.addEventListener("pointerdown", tryEnter, { capture: true, passive: true });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") tryEnter();
  });
  document.addEventListener("fullscreenchange", syncFullscreenClass);
  document.addEventListener("webkitfullscreenchange", syncFullscreenClass);
}

export function bindFullscreenCheckbox(input) {
  if (!input) return;
  const row = input.closest(".options-check");
  if (!canUseFullscreenApi() && !isMobileAppShell()) {
    if (row) row.hidden = true;
    return;
  }
  input.checked = getFullscreenPref();
  input.addEventListener("change", () => {
    const on = !!input.checked;
    setFullscreenPref(on);
    if (on) enterFullscreen();
    else exitFullscreen();
  });
}
