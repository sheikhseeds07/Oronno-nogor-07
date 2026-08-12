import { createClient } from "@supabase/supabase-js";
import {
  createSupabaseFetch,
  resolveSupabasePublishableKey,
  resolveSupabaseUrl,
} from "@/integrations/supabase/public-env";

const SITE = "https://oronnonogor.com";

/** Builds the full sitemap XML (static pages + categories + products + landings). */
export async function buildSitemapXml(): Promise<string> {
  const url = resolveSupabaseUrl();
  const key = resolveSupabasePublishableKey();
  const sb = createClient(url, key, { global: { fetch: createSupabaseFetch(key) } });

  const [{ data: products }, { data: cats }, { data: landings }] = await Promise.all([
    sb.from("products").select("slug,updated_at").eq("is_active", true).limit(1000),
    sb.from("categories").select("slug").limit(500),
    sb.from("landing_pages").select("slug,created_at").eq("is_published", true).limit(500),
  ]);

  const staticUrls = ["/", "/shop", "/contact"];
  const items: string[] = [];
  const push = (loc: string, lastmod?: string) =>
    items.push(
      `<url><loc>${SITE}${loc}</loc>${lastmod ? `<lastmod>${new Date(lastmod).toISOString()}</lastmod>` : ""}</url>`,
    );

  staticUrls.forEach((u) => push(u));
  (cats ?? []).forEach((c: { slug: string }) => push(`/category/${c.slug}`));
  (products ?? []).forEach((p: { slug: string; updated_at?: string }) => push(`/product/${p.slug}`, p.updated_at));
  (landings ?? []).forEach((l: { slug: string; created_at?: string }) => push(`/landing/${l.slug}`, l.created_at));

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${items.join("\n")}\n</urlset>`;
}

export function sitemapResponse(xml: string) {
  return new Response(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
