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

export function SiteVisitorTracker() {
  const location = useLocation();
  useEffect(() => {
    if (location.pathname.startsWith("/admin")) return;
    const visitorId = (() => {
      const key = "site-visitor-id";
      const old = localStorage.getItem(key);
      if (old) return old;
      const id = createVisitorId();
      localStorage.setItem(key, id);
      return id;
    })();
    let active = true;
    const heartbeat = async () => {
      if (!active) return;
      const path = location.pathname;
      const landingSlug = path.startsWith("/landing/") ? path.split("/")[2] : null;
      const productSlug = path.startsWith("/product/") ? path.split("/")[2] : null;
      let landingPageId: string | null = null;
      let productId: string | null = null;
      if (landingSlug) {
        const { data } = await supabase.from("landing_pages").select("id,product_id").eq("slug", landingSlug).maybeSingle();
        landingPageId = data?.id ?? null;
        productId = data?.product_id ?? null;
      } else if (productSlug) {
        const { data } = await supabase.from("products").select("id").eq("slug", productSlug).maybeSingle();
        productId = data?.id ?? null;
      }
      await (supabase as any).rpc("heartbeat_site_visitor", { p_id: visitorId, p_path: path, p_landing_page_id: landingPageId, p_product_id: productId });
    };
    heartbeat().catch(() => { /* visitor tracking must never break the page */ });
    const timer = window.setInterval(() => { void heartbeat().catch(() => {}); }, 30000);
    return () => { active = false; window.clearInterval(timer); };
  }, [location.pathname]);
  return null;
}
