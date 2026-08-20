import { createFileRoute } from "@tanstack/react-router";

const ALLOWED_SUPABASE_HOST = "bvuhvzccziuniujeogng.supabase.co";
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

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
  // The object path is the stable asset identity. Signed tokens/query strings
  // are required only for the origin fetch and must not create duplicate cache
  // entries for the same stored file.
  const key = new URL(request.url);
  key.search = "";
  key.searchParams.set("asset", source.pathname);
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
    `public, max-age=${ONE_YEAR_SECONDS}, s-maxage=${ONE_YEAR_SECONDS}, immutable`,
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

        // Never cache failures. Existing data remains untouched and callers can
        // retry later; this proxy is an optimization layer, not a data migration.
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
            // Cache API failure must never break live image delivery.
          }
        }

        return response;
      },
    },
  },
});
