import { createFileRoute } from "@tanstack/react-router";

const ALLOWED_SUPABASE_HOST = "bvuhvzccziuniujeogng.supabase.co";
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;
// Egress budget guard: public catalog imagery never needs more than ~1024px on
// phone-first traffic. Lower width/quality keeps Supabase Storage egress flat
// even when visitor count grows, because every byte is pulled once and then
// served from the Cloudflare cache.
const OPTIMIZED_WIDTH = 1024;
const OPTIMIZED_QUALITY = 62;
// Extra-lean variant for data-saver clients / very slow networks.
const ECONOMY_WIDTH = 720;
const ECONOMY_QUALITY = 52;
const NO_STORE = "private, no-store";

// Only these catalog/marketing buckets are intentionally exposed through the
// public /media delivery path. Other signed Storage assets remain private.
const PUBLIC_MEDIA_BUCKETS = new Set([
  "product-images",
  "category-images",
  "banners",
  // Landing/marketing artwork lives here. It was previously excluded, which
  // meant every single page view pulled the full multi-megabyte original from
  // Supabase Storage instead of being served from the Cloudflare cache.
  "site-assets",
  "landing-images",
  "review-images",
  "blog-images",
  "public-assets",
]);

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

type DeliveryVariant = {
  width: number;
  quality: number;
  format: "webp" | "source";
  id: string;
};

const inFlightOriginPulls = new Map<string, Promise<OriginSnapshot>>();

function getCloudflareCache(): CloudflareCache | undefined {
  return (globalThis as typeof globalThis & { caches?: CloudflareCaches }).caches?.default;
}

function getStorageAsset(source: URL): { bucket: string; objectPath: string; signed: boolean } | null {
  const match = source.pathname.match(/^\/storage\/v1\/object\/(public|sign)\/([^/]+)\/(.+)$/);
  if (!match) return null;
  return { bucket: match[2], objectPath: match[3], signed: match[1] === "sign" };
}

function getSafeSource(request: Request): URL | null {
  const raw = new URL(request.url).searchParams.get("src");
  if (!raw) return null;
  try {
    const source = new URL(raw);
    if (source.protocol !== "https:") return null;
    if (source.hostname !== ALLOWED_SUPABASE_HOST) return null;
    if (!getStorageAsset(source)) return null;
    return source;
  } catch {
    return null;
  }
}

function supportsWebp(request: Request): boolean {
  return /(?:^|,)\s*image\/webp(?:\s*;|,|$)/i.test(request.headers.get("Accept") || "");
}

function wantsEconomy(request: Request): boolean {
  const saveData = (request.headers.get("Save-Data") || "").toLowerCase();
  if (saveData.includes("on")) return true;
  const ect = (request.headers.get("ECT") || "").toLowerCase();
  return ect === "slow-2g" || ect === "2g" || ect === "3g";
}

// One canonical variant per (economy, format) pair. A small, fixed variant set
// is what keeps cached egress predictable: no per-visitor width explosion.
function getVariant(request: Request): DeliveryVariant {
  const format = supportsWebp(request) ? "webp" : "source";
  const economy = wantsEconomy(request);
  const width = economy ? ECONOMY_WIDTH : OPTIMIZED_WIDTH;
  const quality = economy ? ECONOMY_QUALITY : OPTIMIZED_QUALITY;
  return { width, quality, format, id: `w${width}-q${quality}-${format}` };
}

function makeCacheKey(request: Request, source: URL, variant: DeliveryVariant): Request {
  const asset = getStorageAsset(source);
  const key = new URL(request.url);
  key.search = "";
  key.searchParams.set("asset", `${asset?.bucket ?? "unknown"}/${asset?.objectPath ?? source.pathname}`);
  key.searchParams.set("variant", variant.id);
  return new Request(key.toString(), { method: "GET" });
}

function makeOriginCacheKey(source: URL, variant: DeliveryVariant): string {
  const asset = getStorageAsset(source);
  return `https://${ALLOWED_SUPABASE_HOST}/storage/v1/object/${asset?.bucket ?? "unknown"}/${asset?.objectPath ?? source.pathname}?v=${variant.id}`;
}

function noStoreResponse(body: BodyInit | null, status: number, statusText = "", sourceHeaders?: Headers): Response {
  const headers = new Headers(sourceHeaders);
  headers.set("Cache-Control", NO_STORE);
  headers.set("CDN-Cache-Control", NO_STORE);
  headers.set("Cloudflare-CDN-Cache-Control", NO_STORE);
  headers.delete("Set-Cookie");
  return new Response(body, { status, statusText, headers });
}

function cacheableResponse(
  snapshot: OriginSnapshot,
  body: ArrayBuffer,
  cacheState: "HIT" | "MISS",
  variant: DeliveryVariant,
): Response {
  const headers = new Headers();
  const contentType = snapshot.headers.get("content-type");
  const contentLength = snapshot.headers.get("content-length");
  const etag = snapshot.headers.get("etag");
  const lastModified = snapshot.headers.get("last-modified");
  const cfResized = snapshot.headers.get("cf-resized");

  if (contentType) headers.set("Content-Type", contentType);
  if (contentLength) headers.set("Content-Length", contentLength);
  if (etag) headers.set("ETag", etag);
  if (lastModified) headers.set("Last-Modified", lastModified);

  const cachePolicy = `public, max-age=${ONE_YEAR_SECONDS}, s-maxage=${ONE_YEAR_SECONDS}, immutable`;
  headers.set("Cache-Control", cachePolicy);
  headers.set("CDN-Cache-Control", cachePolicy);
  headers.set("Cloudflare-CDN-Cache-Control", cachePolicy);
  headers.set("X-Oronno-Media-Cache", cacheState);
  headers.set("X-Oronno-Media-Variant", variant.id);
  // The output format is already baked into the canonical cache key, so do
  // not emit Vary: Accept. Cloudflare cache keys must not depend on a Vary
  // dimension that is not explicitly supported by the edge cache.
  if (cfResized) {
    headers.set("X-Oronno-Media-Optimized", "true");
    headers.set("X-Oronno-Cf-Resized", cfResized);
  }

  return new Response(body, { status: snapshot.status, statusText: snapshot.statusText, headers });
}

async function pullOrigin(
  source: URL,
  originCacheKey: string,
  request: Request,
  publicAsset: boolean,
  variant: DeliveryVariant,
): Promise<OriginSnapshot> {
  const taskKey = `${source.toString()}|${variant.id}`;
  const existing = inFlightOriginPulls.get(taskKey);
  if (existing) return existing;

  const task = (async (): Promise<OriginSnapshot> => {
    const imageOptions: Record<string, unknown> = {
      fit: "scale-down",
      width: variant.width,
      quality: variant.quality,
      // Strip EXIF/ICC payloads; they add bytes with no visual benefit.
      metadata: "none",
    };
    if (variant.format === "webp") imageOptions.format = "webp";

    const origin = await fetch(source.toString(), {
      method: "GET",
      headers: { Accept: request.headers.get("Accept") || "image/*,*/*;q=0.8" },
      ...({ cf: publicAsset
        ? ({
            cacheEverything: true,
            cacheTtl: ONE_YEAR_SECONDS,
            cacheKey: originCacheKey,
            image: imageOptions,
          } as any)
        : undefined } as RequestInit),
    });

    return {
      ok: origin.ok,
      status: origin.status,
      statusText: origin.statusText,
      headers: new Headers(origin.headers),
      body: await origin.arrayBuffer(),
    };
  })();

  inFlightOriginPulls.set(taskKey, task);
  try {
    return await task;
  } finally {
    if (inFlightOriginPulls.get(taskKey) === task) inFlightOriginPulls.delete(taskKey);
  }
}

export const Route = createFileRoute("/media")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const source = getSafeSource(request);
        if (!source) return noStoreResponse("Invalid media source", 400);

        const asset = getStorageAsset(source);
        if (!asset) return noStoreResponse("Invalid storage asset", 400);

        const publicAsset = PUBLIC_MEDIA_BUCKETS.has(asset.bucket);
        const variant = getVariant(request);

        // Non-public/user-specific Storage assets remain functional but never
        // become publicly cacheable through /media.
        if (!publicAsset) {
          const origin = await pullOrigin(source, "", request, false, variant);
          return noStoreResponse(origin.body.slice(0), origin.status, origin.statusText, origin.headers);
        }

        // Conditional requests: if the browser already has the bytes, answer 304
        // and send no body at all.
        const cache = getCloudflareCache();
        const cacheKey = makeCacheKey(request, source, variant);
        const originCacheKey = makeOriginCacheKey(source, variant);
        const ifNoneMatch = request.headers.get("If-None-Match");

        if (cache) {
          const hit = await cache.match(cacheKey);
          if (hit) {
            const hitEtag = hit.headers.get("ETag");
            if (ifNoneMatch && hitEtag && ifNoneMatch.includes(hitEtag)) {
              const headers = new Headers(hit.headers);
              headers.delete("Content-Length");
              headers.set("X-Oronno-Media-Cache", "HIT-304");
              return new Response(null, { status: 304, headers });
            }
            const headers = new Headers(hit.headers);
            headers.set("X-Oronno-Media-Cache", "HIT");
            return new Response(hit.body, { status: hit.status, statusText: hit.statusText, headers });
          }
        }

        const origin = await pullOrigin(source, originCacheKey, request, true, variant);
        if (!origin.ok) return noStoreResponse(origin.body.slice(0), origin.status, origin.statusText, origin.headers);

        const response = cacheableResponse(origin, origin.body.slice(0), "MISS", variant);
        if (cache) {
          try {
            await cache.put(cacheKey, cacheableResponse(origin, origin.body.slice(0), "HIT", variant));
          } catch {
            // Cache failure must never break image delivery.
          }
        }
        return response;
      },
    },
  },
});
