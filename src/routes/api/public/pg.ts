import { allowRequest } from "@/lib/rate-limit";
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
  "landing_pages",
  "reviews",
  "product_reviews",
  "blog_posts",
  "faqs",
  "testimonials",
]);

const PUBLIC_RPCS = new Set(["get_home_data_v1"]);

// Home RPC contains frequently edited product price/popular fields.
// Keep it cached briefly for egress protection without making admin changes stale for minutes.
const HOME_RPC_TTL_SECONDS = 3600;
const EDGE_TTL_SECONDS = 3600;
const STALE_SECONDS = 86400;
const BROWSER_TTL_SECONDS = 300;

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
        let path = url.searchParams.get("path") || "";
        if (path.length > 1800) return noStore("Query too long", 414);
        if (!isAllowed(path)) return noStore("Not allowed", 400);

        const method = (url.searchParams.get("m") || "GET").toUpperCase();
        const body = url.searchParams.get("b");
        const rpc = path.split("?")[0] === "/rest/v1/rpc/get_home_data_v1";
        if (method !== (rpc ? "POST" : "GET")) return noStore("Method not allowed", 405);
        if (body && body.length > 500) return noStore("Body too large", 413);
        if (!rpc) {
          const target = new URL(path, "https://placeholder.invalid");
          const limit = Number(target.searchParams.get("limit") ?? 100);
          if (!Number.isInteger(limit) || limit < 1 || limit > 100) return noStore("Limit must be 1..100", 400);
          target.searchParams.set("limit", String(limit));
          path = target.pathname + target.search;
        }

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

        // Rate-limit cache misses; cached responses do not consume the budget.
        const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
        if (!allowRequest(`catalog:${ip}`, 60, 60_000)) {
          const response = noStore("Too many requests", 429);
          response.headers.set("Retry-After", "60");
          return response;
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
          signal: AbortSignal.timeout(10_000),
          ...({ cf: { cacheEverything: true, cacheTtl: path.includes("/rpc/get_home_data_v1") ? HOME_RPC_TTL_SECONDS : EDGE_TTL_SECONDS } } as RequestInit),
        });

        const payload = await origin.text();
        if (!origin.ok) return noStore(payload, origin.status);

        const edgeTtl = path.includes("/rpc/get_home_data_v1") ? HOME_RPC_TTL_SECONDS : EDGE_TTL_SECONDS;
        const policy = `public, max-age=${path.includes("/rpc/get_home_data_v1") ? 0 : BROWSER_TTL_SECONDS}, s-maxage=${edgeTtl}, stale-while-revalidate=${path.includes("/rpc/get_home_data_v1") ? 0 : STALE_SECONDS}`;
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
