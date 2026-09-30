import { createFileRoute } from "@tanstack/react-router";
import { getCloudflareR2Bucket } from "@/lib/cloudflare-r2.server";
import { legacyMediaKey, legacyMediaBucket, safeMediaKey, PUBLIC_MEDIA_BUCKETS } from "@/lib/r2-media";

type R2ObjectLike = {
  body: ReadableStream<Uint8Array>;
  httpEtag?: string;
  writeHttpMetadata?: (headers: Headers) => void;
};
type R2BucketLike = { get(key: string): Promise<R2ObjectLike | null> };
type EdgeCache = { match(key: Request): Promise<Response | undefined>; put(key: Request, response: Response): Promise<void> };
type Snapshot = { body: ArrayBuffer; headers: Headers };
const inflight = new Map<string, Promise<Snapshot | null>>();

function response(body: BodyInit | null, status: number, policy: string, initial?: Headers) {
  const headers = new Headers(initial);
  for (const name of ["Cache-Control", "CDN-Cache-Control", "Cloudflare-CDN-Cache-Control"]) headers.set(name, policy);
  headers.delete("Set-Cookie");
  return new Response(body, { status, headers });
}

async function readR2(bucket: R2BucketLike, key: string): Promise<Snapshot | null> {
  const pending = inflight.get(key);
  if (pending) return pending;
  const pull = (async () => {
    const object = await bucket.get(key);
    if (!object) return null;
    const headers = new Headers();
    object.writeHttpMetadata?.(headers);
    if (object.httpEtag) headers.set("ETag", object.httpEtag);
    const body = await new Response(object.body).arrayBuffer();
    headers.set("Content-Length", String(body.byteLength));
    return { headers, body };
  })();
  inflight.set(key, pull);
  try { return await pull; } finally { inflight.delete(key); }
}

async function serveMedia(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const rawKey = url.searchParams.get("asset");
  const source = url.searchParams.get("src");
  const requestedBucket = rawKey ? rawKey.split("/")[0] : source ? legacyMediaBucket(source) : null;
  if (requestedBucket && !PUBLIC_MEDIA_BUCKETS.has(requestedBucket)) return response("Media bucket not allowed", 403, "private, no-store");
  const key = rawKey ? safeMediaKey(rawKey) : source ? legacyMediaKey(source) : null;
  if (!key) return response("Invalid media asset", 400, "private, no-store");

  const cache = (globalThis as typeof globalThis & { caches?: { default?: EdgeCache } }).caches?.default;
  const cacheUrl = new URL("/media", url.origin);
  cacheUrl.searchParams.set("asset", key);
  const cacheKey = new Request(cacheUrl, { method: "GET" });
  let delivered: Response | undefined;
  try { delivered = await cache?.match(cacheKey); } catch { /* cache failures do not fail media */ }
  if (!delivered) {
    const bucket = getCloudflareR2Bucket<R2BucketLike>();
    if (!bucket) return response("R2 binding unavailable", 503, "private, no-store");
    try {
      const object = await readR2(bucket, key);
      delivered = object
        ? response(object.body, 200, "public, max-age=31536000, s-maxage=31536000, immutable", object.headers)
        : response("R2 object not found", 404, "public, max-age=60, s-maxage=60");
    } catch {
      // A single failed R2 read returns once. No origin fallback, retries or logs.
      return response("R2 temporarily unavailable", 503, "private, no-store");
    }
    delivered.headers.set("X-Oronno-Media-Cache", "MISS");
    try { await cache?.put(cacheKey, delivered.clone()); } catch { /* return the R2 result */ }
  } else {
    delivered = new Response(delivered.body, delivered);
    delivered.headers.set("X-Oronno-Media-Cache", "HIT");
  }
  const etag = delivered.headers.get("ETag");
  const condition = request.headers.get("If-None-Match");
  if (delivered.ok && etag && condition?.split(",").some(value => value.trim() === etag || value.trim() === "*")) {
    const headers = new Headers(delivered.headers);
    headers.delete("Content-Length");
    return new Response(null, { status: 304, headers });
  }
  return delivered;
}

export const Route = createFileRoute("/media")({
  server: { handlers: { GET: ({ request }) => serveMedia(request) } },
});
