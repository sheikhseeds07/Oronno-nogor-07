import { useEffect } from "react";
import { supabase } from "@/lib/personal-supabase/client";

/**
 * Site-wide Facebook Pixel.
 * Mounted once from the root layout so it also covers landing pages that do
 * not use SiteLayout. Loads eagerly and tracks SPA route changes.
 */
export function FacebookPixel() {
  useEffect(() => {
    let cancelled = false;
    let lastPath = "";

    const init = async () => {
      const { data } = await supabase
        .from("site_settings")
        .select("settings")
        .limit(1)
        .maybeSingle();
      if (cancelled || typeof window === "undefined") return;

      const fb = (data?.settings as { facebook?: { pixel_id?: string; enabled?: boolean } } | null)?.facebook;
      if (!fb?.enabled || !fb.pixel_id) return;
      const id = fb.pixel_id;
      const w = window as unknown as Record<string, any>;

      if (!w.fbq) {
        (function (f: any, b: Document, e: string, v: string) {
          if (f.fbq) return;
          const n: any = function (...args: unknown[]) {
            n.callMethod ? n.callMethod.apply(n, args) : n.queue.push(args);
          };
          f.fbq = n;
          if (!f._fbq) f._fbq = n;
          n.push = n;
          n.loaded = true;
          n.version = "2.0";
          n.queue = [];
          const t = b.createElement(e) as HTMLScriptElement;
          t.async = true;
          t.src = v;
          const s = b.getElementsByTagName(e)[0];
          s.parentNode?.insertBefore(t, s);
        })(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");
      }

      // Initialize this configured pixel only once.
      const initialized = (w.__oronnoFbPixels ??= new Set<string>()) as Set<string>;
      if (!initialized.has(id)) {
        w.fbq("init", id);
        initialized.add(id);
      }

      const trackPageView = () => {
        const path = window.location.pathname + window.location.search;
        if (path === lastPath) return;
        lastPath = path;
        w.fbq("track", "PageView");
      };

      trackPageView();

      // TanStack Router changes the URL without a full document reload.
      const originalPushState = history.pushState;
      const originalReplaceState = history.replaceState;
      const onPopState = () => trackPageView();
      history.pushState = function (...args: Parameters<History["pushState"]>) {
        const result = originalPushState.apply(this, args);
        window.dispatchEvent(new Event("oronno:route-change"));
        return result;
      };
      history.replaceState = function (...args: Parameters<History["replaceState"]>) {
        const result = originalReplaceState.apply(this, args);
        window.dispatchEvent(new Event("oronno:route-change"));
        return result;
      };
      window.addEventListener("popstate", onPopState);
      window.addEventListener("oronno:route-change", trackPageView);

      return () => {
        history.pushState = originalPushState;
        history.replaceState = originalReplaceState;
        window.removeEventListener("popstate", onPopState);
        window.removeEventListener("oronno:route-change", trackPageView);
      };
    };

    let cleanup: (() => void) | undefined;
    void init().then((fn) => {
      cleanup = fn;
    });
    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, []);

  return null;
}
