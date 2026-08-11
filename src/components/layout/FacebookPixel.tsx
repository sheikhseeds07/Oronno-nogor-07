import { useEffect } from "react";
import { supabase } from "@/lib/personal-supabase/client";

/**
 * Loads & initialises the global Facebook Pixel from site_settings.facebook.pixel_id.
 * The same pixel is used everywhere on the site (home, shop, product, landing pages).
 * Safe to mount multiple times — fbq is only initialised once per id.
 */
export function FacebookPixel({ eager = false }: { eager?: boolean } = {}) {
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const { data } = await supabase.from("site_settings").select("settings").limit(1).maybeSingle();
      if (cancelled) return;
      const fb = (data?.settings as { facebook?: { pixel_id?: string; enabled?: boolean } } | null)?.facebook;
      if (!fb?.enabled || !fb.pixel_id) return;
      const id = fb.pixel_id;
      if (typeof window === "undefined") return;
      const w = window as unknown as Record<string, unknown>;
      if (w.fbq) {
        /* eslint-disable @typescript-eslint/no-explicit-any */
        (window as any).fbq("init", id);
        (window as any).fbq("track", "PageView");
        /* eslint-enable @typescript-eslint/no-explicit-any */
        return;
      }

      /* eslint-disable @typescript-eslint/no-explicit-any */
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

      (window as any).fbq("init", id);
      (window as any).fbq("track", "PageView");
      /* eslint-enable @typescript-eslint/no-explicit-any */
    };
    if (eager) {
      void run();
      return () => { cancelled = true; };
    }
    const w = window as unknown as { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number };
    const schedule = w.requestIdleCallback ?? ((cb: () => void) => setTimeout(cb, 2500));
    const handle = schedule(() => { void run(); }, { timeout: 4000 });
    return () => { cancelled = true; if (typeof handle === "number") clearTimeout(handle); };
  }, [eager]);
  return null;
}

