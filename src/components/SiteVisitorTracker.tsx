import { useEffect } from "react";
import { useLocation } from "@tanstack/react-router";
import { supabase } from "@/lib/personal-supabase/client";

export function SiteVisitorTracker() {
  const location = useLocation();
  useEffect(() => {
    if (location.pathname.startsWith("/admin")) return;
    const visitorId = (() => {
      const key = "site-visitor-id";
      const old = localStorage.getItem(key);
      if (old) return old;
      const id = crypto.randomUUID();
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
    heartbeat();
    const timer = window.setInterval(heartbeat, 30000);
    return () => { active = false; window.clearInterval(timer); };
  }, [location.pathname]);
  return null;
}
