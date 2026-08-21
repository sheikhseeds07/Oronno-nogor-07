import { useEffect } from "react";
import { useLocation } from "@tanstack/react-router";
import { supabase } from "@/lib/personal-supabase/client";

function createVisitorId(): string {
  try {
    const cryptoApi = globalThis.crypto as Crypto & { randomUUID?: unknown } | undefined;
    if (cryptoApi && typeof cryptoApi.randomUUID === "function") {
      return cryptoApi.randomUUID() as string;
    }
  } catch {
    // Fall through to a non-crypto browser-safe identifier.
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

const VISITOR_ID_KEY = "site-visitor-id";
const VISITOR_LOOKUP_KEY_PREFIX = "site-visitor-route:";
const HEARTBEAT_INTERVAL_MS = 120_000;

export function SiteVisitorTracker() {
  const location = useLocation();

  useEffect(() => {
    if (location.pathname.startsWith("/admin")) return;

    const visitorId = (() => {
      const old = localStorage.getItem(VISITOR_ID_KEY);
      if (old) return old;
      const id = createVisitorId();
      localStorage.setItem(VISITOR_ID_KEY, id);
      return id;
    })();

    let active = true;
    let heartbeatInFlight = false;
    const path = location.pathname;
    const landingSlug = path.startsWith("/landing/") ? path.split("/")[2] : null;
    const productSlug = path.startsWith("/product/") ? path.split("/")[2] : null;
    const lookupKey = `${VISITOR_LOOKUP_KEY_PREFIX}${path}`;

    const getRouteIds = async (): Promise<{
      landingPageId: string | null;
      productId: string | null;
    }> => {
      try {
        const cached = sessionStorage.getItem(lookupKey);
        if (cached) return JSON.parse(cached);
      } catch {
        // Ignore unavailable/corrupt browser storage.
      }

      let landingPageId: string | null = null;
      let productId: string | null = null;

      if (landingSlug) {
        const { data } = await supabase
          .from("landing_pages")
          .select("id,product_id")
          .eq("slug", landingSlug)
          .maybeSingle();
        landingPageId = data?.id ?? null;
        productId = data?.product_id ?? null;
      } else if (productSlug) {
        const { data } = await supabase
          .from("products")
          .select("id")
          .eq("slug", productSlug)
          .maybeSingle();
        productId = data?.id ?? null;
      }

      const result = { landingPageId, productId };
      try {
        sessionStorage.setItem(lookupKey, JSON.stringify(result));
      } catch {
        // Ignore storage quota/privacy restrictions.
      }
      return result;
    };

    const heartbeat = async () => {
      if (!active || heartbeatInFlight) return;
      heartbeatInFlight = true;
      try {
        const { landingPageId, productId } = await getRouteIds();
        await (supabase as any).rpc("heartbeat_site_visitor", {
          p_id: visitorId,
          p_path: path,
          p_landing_page_id: landingPageId,
          p_product_id: productId,
        });
      } finally {
        heartbeatInFlight = false;
      }
    };

    // One event per route, then a low-frequency heartbeat while the page remains open.
    heartbeat().catch(() => {
      /* visitor tracking must never break the page */
    });
    const timer = window.setInterval(() => {
      void heartbeat().catch(() => {});
    }, HEARTBEAT_INTERVAL_MS);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [location.pathname]);

  return null;
}
