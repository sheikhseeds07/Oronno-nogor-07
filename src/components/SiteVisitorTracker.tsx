import { useEffect } from "react";
import { useLocation } from "@tanstack/react-router";
import { supabase } from "@/lib/personal-supabase/client";
import { cachedRequest } from "@/lib/egress-optimization";

function createVisitorId(): string {
  try {
    const cryptoApi = globalThis.crypto as Crypto & { randomUUID?: unknown } | undefined;
    if (cryptoApi && typeof cryptoApi.randomUUID === "function") return cryptoApi.randomUUID() as string;
  } catch {}
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

const VISITOR_ID_KEY = "site-visitor-id";
const VISITOR_LOOKUP_KEY_PREFIX = "site-visitor-route:";
const VISITOR_BEAT_KEY_PREFIX = "site-visitor-beat:";
// One presence write per visitor per path per window. Live-visitor accuracy
// stays useful while request volume (and its egress) stops scaling with how
// often a visitor navigates back and forth.
const BEAT_WINDOW_MS = 3_600_000;

function shouldRecordBeat(path: string): boolean {
  try {
    const key = `${VISITOR_BEAT_KEY_PREFIX}${path}`;
    const last = Number(sessionStorage.getItem(key) || 0);
    if (Number.isFinite(last) && Date.now() - last < BEAT_WINDOW_MS) return false;
    sessionStorage.setItem(key, String(Date.now()));
    return true;
  } catch {
    return true;
  }
}

export function SiteVisitorTracker() {
  const location = useLocation();

  useEffect(() => {
    const path = location.pathname;
    const trackable = path === "/" || path.startsWith("/landing/");
    if (!trackable) return;
    if (!shouldRecordBeat(path)) return;

    const visitorId = (() => {
      const old = localStorage.getItem(VISITOR_ID_KEY);
      if (old) return old;
      const id = createVisitorId();
      localStorage.setItem(VISITOR_ID_KEY, id);
      return id;
    })();

    let active = true;
    const controller = new AbortController();
    const landingSlug = path.startsWith("/landing/") ? path.split("/")[2] : null;
    const lookupKey = `${VISITOR_LOOKUP_KEY_PREFIX}${path}`;

    const getRouteIds = () => cachedRequest(`visitor-route:${path}`, async () => {
      try {
        const raw = localStorage.getItem(lookupKey);
        if (raw) {
          const parsed = JSON.parse(raw) as { at: number; value: { landingPageId: string | null; productId: string | null } };
          if (parsed?.value && Date.now() - parsed.at < 86_400_000) return parsed.value;
        }
      } catch {}

      let landingPageId: string | null = null;
      let productId: string | null = null;
      if (landingSlug) {
        const { data } = await supabase.from("landing_pages").select("id,product_id").eq("slug", landingSlug).abortSignal(controller.signal).maybeSingle();
        landingPageId = data?.id ?? null;
        productId = data?.product_id ?? null;
      }
      const result = { landingPageId, productId };
      try { localStorage.setItem(lookupKey, JSON.stringify({ at: Date.now(), value: result })); } catch {}
      return result;
    }, 900_000);

    const recordVisit = async () => {
      // Hidden/prerendered tabs must not spend a request at all.
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      const { landingPageId, productId } = await getRouteIds();
      if (!active) return;
      await (supabase as any).rpc("heartbeat_site_visitor", {
        p_id: visitorId,
        p_path: path,
        p_landing_page_id: landingPageId,
        p_product_id: productId,
      });
    };

    // Speed: presence tracking is analytics-only, so it must never share
    // bandwidth with the content queries that paint the page.
    let idleTimer = 0;
    const startTracking = () => { void recordVisit().catch(() => {}); };
    const idle = (window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
    if (typeof idle === "function") idle(startTracking, { timeout: 4000 });
    else idleTimer = window.setTimeout(startTracking, 2000);
    return () => { active = false; controller.abort(); if (idleTimer) window.clearTimeout(idleTimer); };
  }, [location.pathname]);

  return null;
}
