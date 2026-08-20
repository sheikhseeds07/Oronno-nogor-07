import { createFileRoute } from "@tanstack/react-router";

const ALLOWED_SUPABASE_HOST = "bvuhvzccziuniujeogng.supabase.co";
const EDGE_TTL_SECONDS = 60 * 60 * 24 * 30;
const BROWSER_TTL_SECONDS = 60 * 60 * 24 * 7;

type CloudflareCache = {
  match(request: Request): Promise<Response | undefined>;
  put(request: Request, response: Response): Promise<void>;
};

type CloudflareCaches = {
  default?: CloudflareCache;
};

function getCloudflareCache(): CloudflareCache | undefined {
  return (globalThis as typeof globalThis & { caches?: CloudflareCaches }).caches?.default;
}

function getSafeSource(request: Request): URL | null {
  const requestUrl = new URL(request.url);
  const raw = requestUrl.searchParams.get("src");
  if (!raw) return null;

  try {
    const source = new URL(raw);
    if (source.protocol !== "https:") return null;
    if (source.hostname !== ALLOWED_SUPABASE_HOST) return null;
    if (!source.pathname.startsWith("/storage/v1/")) return null;
    return source;
  } catch {
    return null;
  }
}

function makeCacheKey(request: Request, source: URL): Request {
  // Signed URLs contain a long-lived token. It is required for the origin fetch,
  // but it must not fragment the Cloudflare cache when the same file gets a new
  // signed URL later. Width/quality/format params are intentionally preserved.
  const normalized = new URL(source.toString());
  normalized.searchParams.delete("token");
  normalized.searchParams.sort();

  const key = new URL(request.url);
  key.search = "";
  key.searchParams.set("asset", `${normalized.pathname}?${normalized.searchParams.toString()}`);
  return new Request(key.toString(), { method: "GET" });
}

function cacheableResponse(origin: Response, body: ArrayBuffer, cacheState: "HIT" | "MISS"): Response {
  const headers = new Headers();
  const contentType = origin.headers.get("content-type");
  const etag = origin.headers.get("etag");
  const lastModified = origin.headers.get("last-modified");

  if (contentType) headers.set("Content-Type", contentType);
  if (etag) headers.set("ETag", etag);
  if (lastModified) headers.set("Last-Modified", lastModified);
  headers.set(
    "Cache-Control",
    `public, max-age=${BROWSER_TTL_SECONDS}, s-maxage=${EDGE_TTL_SECONDS}, immutable`,
  );
  headers.set("X-Oronno-Media-Cache", cacheState);

  return new Response(body, {
    status: origin.status,
    statusText: origin.statusText,
    headers,
  });
}

export const Route = createFileRoute("/media")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const source = getSafeSource(request);
        if (!source) return new Response("Invalid media source", { status: 400 });

        const cache = getCloudflareCache();
        const cacheKey = makeCacheKey(request, source);

        if (cache) {
          const hit = await cache.match(cacheKey);
          if (hit) {
            const headers = new Headers(hit.headers);
            headers.set("X-Oronno-Media-Cache", "HIT");
            return new Response(hit.body, { status: hit.status, statusText: hit.statusText, headers });
          }
        }

        const origin = await fetch(source.toString(), {
          method: "GET",
          headers: { Accept: "image/avif,image/webp,image/*,*/*;q=0.8" },
          signal: request.signal,
        });

        // Do not cache errors. The image element's onError handler will retry
        // through the same proxy using the raw Supabase object URL.
        if (!origin.ok) {
          return new Response(origin.body, {
            status: origin.status,
            statusText: origin.statusText,
            headers: origin.headers,
          });
        }

        const body = await origin.arrayBuffer();
        const response = cacheableResponse(origin, body, "MISS");

        if (cache) {
          try {
            const cached = cacheableResponse(origin, body.slice(0), "HIT");
            await cache.put(cacheKey, cached);
          } catch {
            // Cache API is an optimization only; never break image delivery.
          }
        }

        return response;
      },
    },
  },
});
