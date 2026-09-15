/**
 * Register the service worker and pull updates when the app is opened.
 * When a new SW activates, reload once so players land on the latest build.
 * Localhost skips the worker so a stale cache can't blank hub images.
 */
export function registerPwa() {
  if (!("serviceWorker" in navigator)) return;

  const local = location.hostname === "127.0.0.1" || location.hostname === "localhost";
  if (local) {
    navigator.serviceWorker.getRegistrations().then((regs) => {
      regs.forEach((reg) => reg.unregister());
    }).catch(() => {});
    if (typeof caches !== "undefined") {
      caches.keys().then((keys) => {
        keys
          .filter((k) => k.startsWith("ranger-descent-"))
          .forEach((k) => caches.delete(k));
      }).catch(() => {});
    }
    return;
  }

  window.addEventListener("load", async () => {
    try {
      const reg = await navigator.serviceWorker.register("./sw.js", { scope: "./" });
      try {
        reg.update();
      } catch (_) {
        /* ignore */
      }

      // Ask waiting workers to activate immediately.
      if (reg.waiting) reg.waiting.postMessage({ type: "SKIP_WAITING" });
      reg.addEventListener("updatefound", () => {
        const sw = reg.installing;
        if (!sw) return;
        sw.addEventListener("statechange", () => {
          if (sw.state === "installed" && navigator.serviceWorker.controller) {
            sw.postMessage({ type: "SKIP_WAITING" });
          }
        });
      });
    } catch (err) {
      console.warn("PWA register failed:", err);
    }
  });

  let refreshing = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (refreshing) return;
    refreshing = true;
    location.reload();
  });
}
