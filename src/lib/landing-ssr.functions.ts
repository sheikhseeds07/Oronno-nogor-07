import { createServerFn } from "@tanstack/react-start";
import { supabase } from "@/lib/personal-supabase/client";

// Server-side landing page bundle: one round trip, executed during SSR so the
// first HTML response already contains the page content.
export const getLandingSsrBundle = createServerFn({ method: "GET" })
  .inputValidator((data: { slug: string }) => ({ slug: String(data?.slug ?? "").slice(0, 160) }))
  .handler(async ({ data }) => {
    if (!data.slug) return null;
    const [pageRes, settingsRes] = await Promise.all([
      supabase.from("landing_pages").select("*, products(*)").eq("slug", data.slug).eq("is_published", true).maybeSingle(),
      supabase.from("site_settings").select("settings").maybeSingle(),
    ]);
    return { page: pageRes.data ?? null, settings: settingsRes.data ?? null };
  });
