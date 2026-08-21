import { createFileRoute } from "@tanstack/react-router";

const ALLOWED_SUPABASE_HOST = "bvuhvzccziuniujeogng.supabase.co";
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;
const OPTIMIZED_WIDTH = 1920;
const OPTIMIZED_QUALITY = 82;
const NO_STORE = "private, no-store";

// These buckets are used for public-facing catalog/marketing assets. Other
// buckets remain private/no-store even if a signed URL is accidentally routed
// through /media.
const PUBLIC_MEDIA_BUCKETS = new Set(["product-images", "category-images", "banners"]);

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
  transformed: boolean;
  publicAsset: boolean;
};

// Coalesce bursts so identical images do not create parallel origin pulls.
const inFlightOriginPulls = new Map<string, Promise<OriginSnapshot>>();

function getCloudflareCache(): CloudflareCache | undefined {
  return (globalThis as typeof globalThis & { caches?: CloudflareCaches }).caches?.default;
}

function getStorageAsset(source: URL): { bucket: string; objectPath: string; signed: boolean } | null {
  const match = source.pathname.match(/^\/storage\/v1\/object\/(public|sign)\/([^/]+)\/(.+)$/);
  if (!match) return null;
  return {
    bucket: match[2],
    objectPath: match[3],
    signed: match[1] === "sign",
  };
}

function getSafeSource(request: Request): URL | null {
  const requestUrl = new URL(request.url);
  const raw = requestUrl.searchParams.get("src");
  if (!raw) return null;

  try {
    const source = new URL(raw);
    if (source.protocol !== "https:") return null;
    if (source.hostname !== ALLOWED_SUPABASE_HOST) return null;
    if (!source.pathname.startsWith("/storage/v1/object/")) return null;
    if (!getStorageAsset(source)) return null;
    return source;
  } catch {
    return null;
  }
}

function getOutputFormat(request: Request): "webp" | "source" {
  return /(?:^|,)\s*image\/webp(?:\s*;|,|$)/i.test(request.headers.get("Accept") || "")
    ? "webp"
    : "source";
}

function makeCacheKey(request: Request, source: URL, format: "webp" | "source"): Request {
  const asset = getStorageAsset(source);
  const key = new URL(request.url);
  key.search = "";
  key.searchParams.set("asset", `${asset?.bucket ?? "unknown"}/${asset?.objectPath ?? source.pathname}`);
  key.searchParams.set("variant", `w${OPTIMIZED_WIDTH}-q${OPTIMIZED_QUALITY}-${format}`);
  return new Request(key.toString(), { method: "GET" });
}

function makeOriginCacheKey(source: URL): string {
  const asset = getStorageAsset(source);
  // For explicitly public-facing buckets, the signed token is only origin
  // authorization. It must not fragment the cache key. Non-public buckets are
  // never sent through this key because they are kept no-store below.
  return `https://${ALLOWED_SUPABASE_HOST}/storage/v1/object/${asset?.bucket ?? "unknown"}/${asset?.objectPath ?? source.pathname}`;
}

function noStoreResponse(
  body: BodyInit | null,
  status: number,
  statusText = "",
  sourceHeaders?: Headers,
): Response {
  const headers = new Headers(sourceHeaders);
  headers.set("Cache-Control", NO_STORE);
  headers.set("CDN-Cache-Control", NO_STORE);
  headers.set("Cloudflare-CDN-Cache-Control", NO_STORE);
  headers.delete("Set-Cookie");
  return new Response(body, { status, statusText, headers });
}

function cacheableResponse(snapshot: OriginSnapshot, body: ArrayBuffer, cacheState: "HIT" | "MISS"): Response {
  const headers = new Headers();
  const contentType = snapshot.headers.get("content-type");
  const etag = snapshot.headers.get("etag");
  const lastModified = snapshot.headers.get("last-modified");
  const contentLength = snapshot.headers.get("content-length");
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
  headers.set("X-Oronno-Media-Variant", `w${OPTIMIZED_WIDTH}-q${OPTIMIZED_QUALITY}`);
  headers.set("Vary", "Accept");

  // This indicates that Cloudflare's image pipeline actually ran. It does not
  // claim a byte reduction; Content-Length must be compared with the source.
  if (cfResized) headers.set("X-Oronno-Media-Optimized", "true");
  if (cfResized) headers.set("X-Oronno-Cf-Resized", cfResized);

  return new Response(body, {
    status: snapshot.status,
    statusText: snapshot.statusText,
    headers,
  });
}

async function pullOrigin(
  source: URL,
  originCacheKey: string,
  request: Request,
  publicAsset: boolean,
): Promise<OriginSnapshot> {
  const outputFormat = getOutputFormat(request);
  const taskKey = `${source.toString()}|${outputFormat}`;
  const existing = inFlightOriginPulls.get(taskKey);
  if (existing) return existing;

  const task = (async (): Promise<OriginSnapshot> => {
    const imageOptions: Record<string, unknown> = {
      fit: "scale-down",
      width: OPTIMIZED_WIDTH,
      quality: OPTIMIZED_QUALITY,
    };

    // WebP is only requested when the browser explicitly supports it. For
    // other browsers, keep the source format while still resizing/compressing.
    if (outputFormat === "webp") imageOptions.format = "webp";

    const origin = await fetch(source.toString(), {
      method: "GET",
      headers: {
        Accept: request.headers.get("Accept") || "image/*,*/*;q=0.8",
      },
      cf: publicAsset
        ? {
            cacheEverything: true,
            cacheTtl: ONE_YEAR_SECONDS,
            cacheKey: originCacheKey,
            image: imageOptions,
          }
        : undefined,
    });

    const body = await origin.arrayBuffer();
    return {
      ok: origin.ok,
      status: origin.status,
      statusText: origin.statusText,
      headers: new Headers(origin.headers),
      body,
      transformed: Boolean(origin.headers.get("cf-resized")),
      publicAsset,
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
        const rawSource = getSafeSource(request);
        if (!rawSource) return noStoreResponse("Invalid media source", 400);

        const asset = getStorageAsset(rawSource);
        if (!asset) return noStoreResponse("Invalid storage asset", 400);

        const publicAsset = PUBLIC_MEDIA_BUCKETS.has(asset.bucket);
        const outputFormat = getOutputFormat(request);
        const cache = getCloudflareCache();

        // Private/user-specific buckets are still served normally, but are
        // never made publicly cacheable or transformed into a public variant.
        if (!publicAsset) {
          const origin = await pullOrigin(rawSource, "", request, false);
          if (!origin.ok) return noStoreResponse(origin.body.slice(0), origin.status, origin.statusText, origin.headers);
          return noStoreResponse(origin.body.slice(0), origin.status, origin.statusText, origin.headers);
        }

        const cacheKey = makeCacheKey(request, rawSource, outputFormat);
        const originCacheKey = makeOriginCacheKey(rawSource);

        if (cache) {
          const hit = await cache.match(cacheKey);
          if (hit) {
            const headers = new Headers(hit.headers);
            headers.set("X-Oronno-Media-Cache", "HIT");
            return new Response(hit.body, { status: hit.status, statusText: hit.statusText, headers });
          }
        }

        const origin = await pullOrigin(rawSource, originCacheKey, request, true);
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
