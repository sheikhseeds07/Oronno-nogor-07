import { useEffect } from "react";
import { getCachedPixelId, setCachedPixelId, flushFbqQueue, trackPageView } from "@/lib/fbq";

type Props = { eager?: boolean };

function loadScript() {
  if (typeof window === "undefined") return;
  const existing = document.querySelector('script[data-oronno-fb-pixel="1"]');
  if (existing) return;
  const inject = () => {
    if (document.querySelector('script[data-oronno-fb-pixel="1"]')) return;
    const script = document.createElement("script");
    script.async = true;
    script.dataset.oronnoFbPixel = "1";
    script.src = "https://connect.facebook.net/en_US/fbevents.js";
    script.addEventListener("load", () => window.dispatchEvent(new Event("oronno:fb-pixel-ready")), { once: true });
    document.head.appendChild(script);
  };
  const idle = (window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
  if (typeof idle === "function") idle(inject, { timeout: 2500 });
  else window.setTimeout(inject, 1200);
}

function initPixel(pixelId: string) {
  const w = window as unknown as Record<string, any>;
  if (!w.fbq) {
    const n: any = function (...args: unknown[]) { n.callMethod ? n.callMethod.apply(n, args) : n.queue.push(args); };
    n.push = n;
    n.loaded = true;
    n.version = "2.0";
    n.queue = [];
    w.fbq = n;
    w._fbq = n;
  }
  const initialized = (w.__oronnoFbPixels ??= new Set<string>()) as Set<string>;
  if (!initialized.has(pixelId)) {
    w.fbq("init", pixelId);
    initialized.add(pixelId);
  }
  loadScript();
  flushFbqQueue();
}

export function FacebookPixel({ eager = true }: Props) {
  useEffect(() => {
    let cancelled = false;
    let lastPath = "";
    let cleanup: (() => void) | undefined;

    const start = async () => {
      if (window.location.pathname.startsWith("/admin")) return;
      const runtime = window as unknown as Record<string, unknown>;
      if (runtime.__oronnoFacebookPixelOwner) return;
      runtime.__oronnoFacebookPixelOwner = true;

      const pageView = () => {
        const path = window.location.pathname + window.location.search;
        if (window.location.pathname.startsWith("/admin") || path === lastPath) return;
        lastPath = path;
        trackPageView();
      };

      const onPixelReady = () => flushFbqQueue();
      window.addEventListener("oronno:fb-pixel-ready", onPixelReady);

      const cached = getCachedPixelId();
      if (cached) {
        initPixel(cached);
        pageView();
      }

      const response = await fetch("/api/public/fb-pixel", { headers: { Accept: "application/json" } }).catch(() => null);
      const config = response?.ok ? await response.json().catch(() => null) : null;
      if (cancelled || typeof window === "undefined") {
        runtime.__oronnoFacebookPixelOwner = false;
        window.removeEventListener("oronno:fb-pixel-ready", onPixelReady);
        return;
      }
      const pixelId = typeof config?.pixel_id === "string" && config.enabled !== false ? config.pixel_id : null;
      if (!pixelId) {
        window.removeEventListener("oronno:fb-pixel-ready", onPixelReady);
        return;
      }
      setCachedPixelId(pixelId);
      initPixel(pixelId);
      pageView();

      const originalPushState = history.pushState;
      const originalReplaceState = history.replaceState;
      const onRoute = () => pageView();
      history.pushState = function (...args: Parameters<History["pushState"]>) { const result = originalPushState.apply(this, args); window.dispatchEvent(new Event("oronno:route-change")); return result; };
      history.replaceState = function (...args: Parameters<History["replaceState"]>) { const result = originalReplaceState.apply(this, args); window.dispatchEvent(new Event("oronno:route-change")); return result; };
      window.addEventListener("popstate", onRoute);
      window.addEventListener("oronno:route-change", onRoute);
      cleanup = () => {
        runtime.__oronnoFacebookPixelOwner = false;
        window.removeEventListener("oronno:fb-pixel-ready", onPixelReady);
        history.pushState = originalPushState;
        history.replaceState = originalReplaceState;
        window.removeEventListener("popstate", onRoute);
        window.removeEventListener("oronno:route-change", onRoute);
      };
    };

    if (eager) void start();
    else { const timer = window.setTimeout(() => void start(), 0); return () => { cancelled = true; window.clearTimeout(timer); cleanup?.(); }; }
    return () => { cancelled = true; cleanup?.(); };
  }, [eager]);

  return null;
}
