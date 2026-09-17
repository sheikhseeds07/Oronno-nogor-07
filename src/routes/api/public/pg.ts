import { createFileRoute } from "@tanstack/react-router";
import { resolveSupabaseUrl, resolveSupabasePublishableKey } from "@/integrations/supabase/public-env";

// Edge-cached read proxy for anonymous public catalog data.
//
// Every visitor used to hit Supabase REST directly, so one product page view or
// one landing page view cost real Supabase egress. Anonymous reads are identical
// for everyone, so they are pulled once per TTL by the Cloudflare edge and then
// served from cache. Supabase egress becomes a function of time, not traffic.

const PUBLIC_TABLES = new Set([
  "products",
  "categories",
  "banners",
  "site_settings",
  "reviews",
  "product_reviews",
  "blog_posts",
  "faqs",
  "testimonials",
]);

const PUBLIC_RPCS = new Set(["get_home_data_v1"]);

const EDGE_TTL_SECONDS = 300;
const STALE_SECONDS = 1800;
const BROWSER_TTL_SECONDS = 60;

type CloudflareCache = {
  match(request: Request): Promise<Response | undefined>;
  put(request: Request, response: Response): Promise<void>;
};

function edgeCache(): CloudflareCache | undefined {
  return (globalThis as { caches?: { default?: CloudflareCache } }).caches?.default;
}

function isAllowed(path: string): boolean {
  if (!path.startsWith("/rest/v1/")) return false;
  const rest = path.slice("/rest/v1/".length);
  const [head] = rest.split("?");
  if (!head) return false;
  if (head.startsWith("rpc/")) return PUBLIC_RPCS.has(head.slice(4));
  return PUBLIC_TABLES.has(head);
}

function noStore(body: string, status: number): Response {
  return new Response(body, {
    status,
    headers: { "Content-Type": "text/plain", "Cache-Control": "private, no-store" },
  });
}

export const Route = createFileRoute("/api/public/pg")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const path = url.searchParams.get("path") || "";
        if (!isAllowed(path)) return noStore("Not allowed", 400);

        const method = (url.searchParams.get("m") || "GET").toUpperCase();
        const body = url.searchParams.get("b");
        if (method !== "GET" && method !== "POST") return noStore("Not allowed", 400);

        const accept = request.headers.get("Accept") || "application/json";
        const range = request.headers.get("Range") || "";

        const cacheKeyUrl = new URL(url.origin + "/api/public/pg");
        cacheKeyUrl.searchParams.set("path", path);
        cacheKeyUrl.searchParams.set("m", method);
        if (body) cacheKeyUrl.searchParams.set("b", body);
        cacheKeyUrl.searchParams.set("a", accept);
        if (range) cacheKeyUrl.searchParams.set("r", range);
        const cacheKey = new Request(cacheKeyUrl.toString(), { method: "GET" });

        const cache = edgeCache();
        if (cache) {
          const hit = await cache.match(cacheKey);
          if (hit) {
            const headers = new Headers(hit.headers);
            headers.set("X-Oronno-Pg-Cache", "HIT");
            return new Response(hit.body, { status: hit.status, headers });
          }
        }

        const supabaseUrl = resolveSupabaseUrl();
        const key = resolveSupabasePublishableKey();
        const headers = new Headers({ apikey: key, Accept: accept });
        if (range) headers.set("Range", range);
        if (method === "POST") headers.set("Content-Type", "application/json");

        const origin = await fetch(supabaseUrl + path, {
          method,
          headers,
          body: method === "POST" ? (body ?? "{}") : undefined,
          ...({ cf: { cacheEverything: true, cacheTtl: EDGE_TTL_SECONDS } } as RequestInit),
        });

        const payload = await origin.text();
        if (!origin.ok) return noStore(payload, origin.status);

        const policy = `public, max-age=${BROWSER_TTL_SECONDS}, s-maxage=${EDGE_TTL_SECONDS}, stale-while-revalidate=${STALE_SECONDS}`;
        const make = (state: string) => {
          const out = new Headers({
            "Content-Type": origin.headers.get("content-type") || "application/json",
            "Cache-Control": policy,
            "CDN-Cache-Control": policy,
            "Cloudflare-CDN-Cache-Control": policy,
            "X-Oronno-Pg-Cache": state,
          });
          const contentRange = origin.headers.get("content-range");
          if (contentRange) out.set("Content-Range", contentRange);
          return new Response(payload, { status: 200, headers: out });
        };

        if (cache) {
          try {
            await cache.put(cacheKey, make("HIT"));
          } catch {
            // cache failures must never break reads
          }
        }
        return make("MISS");
      },
    },
  },
});
