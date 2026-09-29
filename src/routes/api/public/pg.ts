import { createFileRoute } from "@tanstack/react-router";
import { env as cfEnv } from "cloudflare:workers";
import { resolveSupabaseUrl, resolveSupabasePublishableKey } from "@/integrations/supabase/public-env";

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

const PRODUCT_KV_TTL_SECONDS = 3600;
const HOME_RPC_TTL_SECONDS = 10;
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

function isProductRead(path: string, method: string): boolean {
  return method === "GET" && path.startsWith("/rest/v1/products");
}

function noStore(body: string, status: number): Response {
  return new Response(body, {
    status,
    headers: { "Content-Type": "text/plain", "Cache-Control": "private, no-store" },
  });
}

function kvKey(path: string, method: string, body: string | null, accept: string, range: string) {
  return ["supa:v1", method, path, body || "", accept, range].join("|");
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
        const key = kvKey(path, method, body, accept, range);
        const kv = cfEnv.SUPA_CACHE;

        if (kv && isProductRead(path, method)) {
          try {
            const hit = await kv.get(key, "text");
            if (hit !== null) {
              return new Response(hit, {
                status: 200,
                headers: {
                  "Content-Type": "application/json",
                  "Cache-Control": "public, max-age=60, s-maxage=3600",
                  "X-Oronno-Pg-Cache": "KV-HIT",
                },
              });
            }
          } catch {
            // KV failure falls back to edge cache/origin.
          }
        }

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
            headers.set("X-Oronno-Pg-Cache", "EDGE-HIT");
            return new Response(hit.body, { status: hit.status, headers });
          }
        }

        const supabaseUrl = resolveSupabaseUrl();
        const supabaseKey = resolveSupabasePublishableKey();
        const headers = new Headers({ apikey: supabaseKey, Accept: accept });
        if (range) headers.set("Range", range);
        if (method === "POST") headers.set("Content-Type", "application/json");

        const origin = await fetch(supabaseUrl + path, {
          method,
          headers,
          body: method === "POST" ? (body ?? "{}") : undefined,
          ...({ cf: { cacheEverything: true, cacheTtl: path.includes("/rpc/get_home_data_v1") ? HOME_RPC_TTL_SECONDS : EDGE_TTL_SECONDS } } as RequestInit),
        });

        const payload = await origin.text();
        if (!origin.ok) return noStore(payload, origin.status);

        if (kv && isProductRead(path, method)) {
          try {
            await kv.put(key, payload, { expirationTtl: PRODUCT_KV_TTL_SECONDS });
          } catch {
            // KV write failure must not break catalog reads.
          }
        }

        const edgeTtl = path.includes("/rpc/get_home_data_v1") ? HOME_RPC_TTL_SECONDS : EDGE_TTL_SECONDS;
        const browserTtl = path.includes("/rpc/get_home_data_v1") ? 0 : BROWSER_TTL_SECONDS;
        const stale = path.includes("/rpc/get_home_data_v1") ? 0 : STALE_SECONDS;
        const policy = `public, max-age=${browserTtl}, s-maxage=${edgeTtl}, stale-while-revalidate=${stale}`;
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
            await cache.put(cacheKey, make("EDGE-HIT"));
          } catch {}
        }
        return make(kv && isProductRead(path, method) ? "KV-MISS" : "EDGE-MISS");
      },
    },
  },
});
