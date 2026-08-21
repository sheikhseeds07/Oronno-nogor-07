import { createFileRoute } from "@tanstack/react-router";

const ALLOWED_SUPABASE_HOST = "bvuhvzccziuniujeogng.supabase.co";
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;
const OPTIMIZED_WIDTH = 1920;
const OPTIMIZED_QUALITY = 82;
const NO_STORE = "private, no-store";

type CloudflareCache = {
  match(request: Request): Promise<Response | undefined>;
  put(request: Request, response: Response): Promise<void>;
};

type CloudflareCaches = {
  default?: CloudflareCache;
};

type OriginSnapshot = {
  ok: boolean;
  status: number;
  statusText: string;
  headers: Headers;
  body: ArrayBuffer;
};

// Coalesce bursts so identical images do not create parallel origin pulls.
const inFlightOriginPulls = new Map<string, Promise<OriginSnapshot>>();

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

function getOptimizedSource(source: URL): URL {
  // Public Storage objects use Supabase's image transformation API. Supabase
  // automatically returns WebP for supported browsers when transformations are
  // requested. Private/signed Storage URLs remain untouched to avoid changing
  // their authorization semantics.
  const match = source.pathname.match(/^\/storage\/v1\/object\/public\/(.+)$/);
  if (!match || source.pathname.includes("/render/image/")) return source;

  const optimized = new URL(source.toString());
  optimized.pathname = `/storage/v1/render/image/public/${match[1]}`;
  optimized.search = "";
  optimized.searchParams.set("width", String(OPTIMIZED_WIDTH));
  optimized.searchParams.set("quality", String(OPTIMIZED_QUALITY));
  optimized.searchParams.set("resize", "contain");
  return optimized;
}

function makeCacheKey(request: Request, source: URL): Request {
  const key = new URL(request.url);
  key.search = "";
  key.searchParams.set("asset", source.pathname);
  key.searchParams.set("variant", `w${OPTIMIZED_WIDTH}-q${OPTIMIZED_QUALITY}-contain`);
  return new Request(key.toString(), { method: "GET" });
}

function makeOriginCacheKey(request: Request, source: URL): string {
  const key = new URL(request.url);
  key.search = "";
  key.searchParams.set("asset", source.pathname);
  key.searchParams.set("variant", `w${OPTIMIZED_WIDTH}-q${OPTIMIZED_QUALITY}-contain`);
  return key.toString();
}

function noStoreResponse(body: BodyInit | null, status: number, statusText = "", sourceHeaders?: Headers): Response {
  const headers = new Headers(sourceHeaders);
  headers.set("Cache-Control", NO_STORE);
  headers.set("CDN-Cache-Control", NO_STORE);
  headers.set("Cloudflare-CDN-Cache-Control", NO_STORE);
  return new Response(body, { status, statusText, headers });
}

function cacheableResponse(snapshot: OriginSnapshot, body: ArrayBuffer, cacheState: "HIT" | "MISS"): Response {
  const headers = new Headers();
  const contentType = snapshot.headers.get("content-type");
  const etag = snapshot.headers.get("etag");
  const lastModified = snapshot.headers.get("last-modified");

  if (contentType) headers.set("Content-Type", contentType);
  if (etag) headers.set("ETag", etag);
  if (lastModified) headers.set("Last-Modified", lastModified);

  const cachePolicy = `public, max-age=${ONE_YEAR_SECONDS}, s-maxage=${ONE_YEAR_SECONDS}, immutable`;
  headers.set("Cache-Control", cachePolicy);
  headers.set("CDN-Cache-Control", cachePolicy);
  headers.set("Cloudflare-CDN-Cache-Control", cachePolicy);
  headers.set("X-Oronno-Media-Cache", cacheState);
  headers.set("X-Oronno-Media-Variant", `w${OPTIMIZED_WIDTH}-q${OPTIMIZED_QUALITY}`);

  return new Response(body, {
    status: snapshot.status,
    statusText: snapshot.statusText,
    headers,
  });
}

async function pullOrigin(source: URL, originCacheKey: string): Promise<OriginSnapshot> {
  const key = source.toString();
  const existing = inFlightOriginPulls.get(key);
  if (existing) return existing;

  const task = (async (): Promise<OriginSnapshot> => {
    const origin = await fetch(source.toString(), {
      method: "GET",
      headers: { Accept: "image/avif,image/webp,image/*,*/*;q=0.8" },
      cf: {
        cacheEverything: true,
        cacheTtl: ONE_YEAR_SECONDS,
        cacheKey: originCacheKey,
      },
    });
    const body = await origin.arrayBuffer();
    return {
      ok: origin.ok,
      status: origin.status,
      statusText: origin.statusText,
      headers: new Headers(origin.headers),
      body,
    };
  })();

  inFlightOriginPulls.set(key, task);
  try {
    return await task;
  } finally {
    if (inFlightOriginPulls.get(key) === task) inFlightOriginPulls.delete(key);
  }
}

export const Route = createFileRoute("/media")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const rawSource = getSafeSource(request);
        if (!rawSource) return noStoreResponse("Invalid media source", 400);

        const source = getOptimizedSource(rawSource);
        const cache = getCloudflareCache();
        const cacheKey = makeCacheKey(request, rawSource);
        const originCacheKey = makeOriginCacheKey(request, rawSource);

        if (cache) {
          const hit = await cache.match(cacheKey);
          if (hit) {
            const headers = new Headers(hit.headers);
            headers.set("X-Oronno-Media-Cache", "HIT");
            return new Response(hit.body, { status: hit.status, statusText: hit.statusText, headers });
          }
        }

        const origin = await pullOrigin(source, originCacheKey);
        if (!origin.ok) {
          return noStoreResponse(origin.body.slice(0), origin.status, origin.statusText, origin.headers);
        }

        const response = cacheableResponse(origin, origin.body.slice(0), "MISS");

        if (cache) {
          try {
            await cache.put(cacheKey, cacheableResponse(origin, origin.body.slice(0), "HIT"));
          } catch {
            // Cache failure must never break image delivery.
          }
        }

        return response;
      },
    },
  },
});
