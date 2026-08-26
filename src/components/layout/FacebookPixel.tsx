import { useEffect } from "react";
import { getCachedPixelId, setCachedPixelId, flushFbqQueue, trackPageView } from "@/lib/fbq";

type Props = { eager?: boolean };

function loadScript() {
  if (typeof window === "undefined" || document.querySelector('script[data-oronno-fb-pixel="1"]')) return;
  const script = document.createElement("script");
  script.async = true;
  script.dataset.oronnoFbPixel = "1";
  script.src = "https://connect.facebook.net/en_US/fbevents.js";
  document.head.appendChild(script);
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
      // Track only the customer-facing website. Admin activity must never pollute ad data.
      if (window.location.pathname.startsWith("/admin")) return;
      const runtime = window as unknown as Record<string, unknown>;
      if (runtime.__oronnoFacebookPixelOwner) return;
      runtime.__oronnoFacebookPixelOwner = true;

      const cached = getCachedPixelId();
      if (cached) initPixel(cached);

      const response = await fetch("/api/public/fb-pixel", { headers: { Accept: "application/json" } }).catch(() => null);
      const config = response?.ok ? await response.json().catch(() => null) : null;
      if (cancelled || typeof window === "undefined") {
        runtime.__oronnoFacebookPixelOwner = false;
        return;
      }
      const pixelId = typeof config?.pixel_id === "string" && config.enabled !== false ? config.pixel_id : null;
      if (!pixelId) return;
      setCachedPixelId(pixelId);
      initPixel(pixelId);

      const pageView = () => {
        const path = window.location.pathname + window.location.search;
        if (window.location.pathname.startsWith("/admin") || path === lastPath) return;
        lastPath = path;
        trackPageView();
      };
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
