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

export function SiteVisitorTracker() {
  const location = useLocation();

  useEffect(() => {
    const path = location.pathname;
    const trackable = path === "/" || path.startsWith("/landing/");
    if (!trackable) return;

    const visitorId = (() => {
      const old = localStorage.getItem(VISITOR_ID_KEY);
      if (old) return old;
      const id = createVisitorId();
      localStorage.setItem(VISITOR_ID_KEY, id);
      return id;
    })();

    let active = true;
    const landingSlug = path.startsWith("/landing/") ? path.split("/")[2] : null;
    const lookupKey = `${VISITOR_LOOKUP_KEY_PREFIX}${path}`;

    const getRouteIds = () => cachedRequest(`visitor-route:${path}`, async () => {
      try {
        const cached = sessionStorage.getItem(lookupKey);
        if (cached) return JSON.parse(cached) as { landingPageId: string | null; productId: string | null };
      } catch {}

      let landingPageId: string | null = null;
      let productId: string | null = null;
      if (landingSlug) {
        const { data } = await supabase.from("landing_pages").select("id,product_id").eq("slug", landingSlug).maybeSingle();
        landingPageId = data?.id ?? null;
        productId = data?.product_id ?? null;
      }
      const result = { landingPageId, productId };
      try { sessionStorage.setItem(lookupKey, JSON.stringify(result)); } catch {}
      return result;
    }, 300_000);

    const recordVisit = async () => {
      const { landingPageId, productId } = await getRouteIds();
      if (!active) return;
      await (supabase as any).rpc("heartbeat_site_visitor", {
        p_id: visitorId,
        p_path: path,
        p_landing_page_id: landingPageId,
        p_product_id: productId,
      });
    };

    void recordVisit().catch(() => {});
    return () => { active = false; };
  }, [location.pathname]);

  return null;
}
