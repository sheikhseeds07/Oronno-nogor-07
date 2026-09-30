import { createFileRoute } from "@tanstack/react-router";
import { getCloudflareR2Bucket } from "@/lib/cloudflare-r2.server";

const ALLOWED_SUPABASE_HOSTS = new Set(["bvuhvzccziuniujeogng.supabase.co", "frtzlibogmethppqmhtr.supabase.co"]);
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;
const OPTIMIZED_WIDTH = 1024;
const OPTIMIZED_QUALITY = 62;
const ECONOMY_WIDTH = 720;
const ECONOMY_QUALITY = 52;
const NO_STORE = "private, no-store";

const PUBLIC_MEDIA_BUCKETS = new Set([
  "product-images", "category-images", "banners", "site-assets", "landing-images",
  "review-images", "customer-profiles", "community-media", "blog-images", "public-assets",
]);

type CloudflareCache = { match(request: Request): Promise<Response | undefined>; put(request: Request, response: Response): Promise<void>; };
type CloudflareCaches = { default?: CloudflareCache; };
type OriginSnapshot = { ok: boolean; status: number; statusText: string; headers: Headers; body: ArrayBuffer; };
type DeliveryVariant = { width: number; quality: number; format: "webp" | "source"; id: string; };
type R2ObjectLike = { body: ReadableStream<Uint8Array>; httpEtag?: string; writeHttpMetadata?: (headers: Headers) => void; };
type R2BucketLike = { get: (key: string) => Promise<R2ObjectLike | null>; put: (key: string, value: ArrayBuffer, options?: { httpMetadata?: { contentType?: string; cacheControl?: string } }) => Promise<unknown>; };

function getR2Bucket(): R2BucketLike | undefined { return getCloudflareR2Bucket<R2BucketLike>(); }
async function pullR2Key(key: string): Promise<OriginSnapshot | null> {
  const bucket = getR2Bucket(); if (!bucket) return null;
  try { const object = await bucket.get(key); if (!object) return null; const headers = new Headers(); object.writeHttpMetadata?.(headers); if (object.httpEtag) headers.set("etag", object.httpEtag); const body = await new Response(object.body).arrayBuffer(); return { ok: true, status: 200, statusText: "OK", headers, body }; } catch { return null; }
}
async function pullR2(asset: { bucket: string; objectPath: string }): Promise<OriginSnapshot | null> { return pullR2Key(`${asset.bucket}/${asset.objectPath}`); }
function r2VariantKey(asset: { bucket: string; objectPath: string }, variant: DeliveryVariant): string { return `_variants/${variant.id}/${asset.bucket}/${asset.objectPath}`; }
async function pullR2Variant(asset: { bucket: string; objectPath: string }, variant: DeliveryVariant): Promise<OriginSnapshot | null> { return pullR2Key(r2VariantKey(asset, variant)); }
async function persistR2Variant(asset: { bucket: string; objectPath: string }, variant: DeliveryVariant, snapshot: OriginSnapshot): Promise<void> {
  const bucket = getR2Bucket(); if (!bucket || !snapshot.ok || snapshot.body.byteLength === 0) return;
  const contentType = snapshot.headers.get("content-type") || undefined;
  try { await bucket.put(r2VariantKey(asset, variant), snapshot.body.slice(0), { httpMetadata: { ...(contentType ? { contentType } : {}), cacheControl: `public, max-age=${ONE_YEAR_SECONDS}, immutable` } }); } catch {}
}
const inFlightOriginPulls = new Map<string, Promise<OriginSnapshot>>();
function getCloudflareCache(): CloudflareCache | undefined { return (globalThis as typeof globalThis & { caches?: CloudflareCaches }).caches?.default; }
function getStorageAsset(source: URL): { bucket: string; objectPath: string; signed: boolean } | null { const match = source.pathname.match(/^\/storage\/v1\/object\/(public|sign)\/([^/]+)\/(.+)$/); if (!match) return null; return { bucket: match[2], objectPath: match[3], signed: match[1] === "sign" }; }
function getSafeSource(request: Request): URL | null { const raw = new URL(request.url).searchParams.get("src"); if (!raw) return null; try { const source = new URL(raw); if (source.protocol !== "https:") return null; if (!ALLOWED_SUPABASE_HOSTS.has(source.hostname)) return null; if (!getStorageAsset(source)) return null; return source; } catch { return null; } }
function getDirectAsset(request: Request): { bucket: string; objectPath: string; signed: false } | null {
  const raw = new URL(request.url).searchParams.get("asset"); if (!raw) return null; let decoded = raw; try { decoded = decodeURIComponent(raw); } catch {}
  const slash = decoded.indexOf("/"); if (slash <= 0) return null; const bucket = decoded.slice(0, slash); const objectPath = decoded.slice(slash + 1).replace(/^\/+/, "");
  if (!PUBLIC_MEDIA_BUCKETS.has(bucket)) return null; if (!objectPath || objectPath.includes("../") || objectPath.includes("/..") || objectPath.includes("\0")) return null; return { bucket, objectPath, signed: false };
}
function supportsWebp(request: Request): boolean { return /(?:^|,)\s*image\/webp(?:\s*;|,|$)/i.test(request.headers.get("Accept") || ""); }
function wantsEconomy(request: Request): boolean { const saveData = (request.headers.get("Save-Data") || "").toLowerCase(); if (saveData.includes("on")) return true; const ect = (request.headers.get("ECT") || "").toLowerCase(); return ect === "slow-2g" || ect === "2g" || ect === "3g"; }
function getVariant(request: Request): DeliveryVariant { const format = supportsWebp(request) ? "webp" : "source"; const economy = wantsEconomy(request); const width = economy ? ECONOMY_WIDTH : OPTIMIZED_WIDTH; const quality = economy ? ECONOMY_QUALITY : OPTIMIZED_QUALITY; return { width, quality, format, id: `w${width}-q${quality}-${format}` }; }
function makeCacheKey(request: Request, asset: { bucket: string; objectPath: string }, variant: DeliveryVariant): Request { const key = new URL(request.url); key.search = ""; key.searchParams.set("asset", `${asset.bucket}/${asset.objectPath}`); key.searchParams.set("variant", variant.id); return new Request(key.toString(), { method: "GET" }); }
function noStoreResponse(body: BodyInit | null, status: number, statusText = "", sourceHeaders?: Headers): Response { const headers = new Headers(sourceHeaders); headers.set("Cache-Control", NO_STORE); headers.set("CDN-Cache-Control", NO_STORE); headers.set("Cloudflare-CDN-Cache-Control", NO_STORE); headers.delete("Set-Cookie"); return new Response(body, { status, statusText, headers }); }
function cacheableResponse(snapshot: OriginSnapshot, body: ArrayBuffer, cacheState: "HIT" | "MISS", variant: DeliveryVariant): Response {
  const headers = new Headers(); const contentType = snapshot.headers.get("content-type"); const contentLength = snapshot.headers.get("content-length"); const etag = snapshot.headers.get("etag"); const lastModified = snapshot.headers.get("last-modified"); const cfResized = snapshot.headers.get("cf-resized"); const supabaseCacheStatus = snapshot.headers.get("cf-cache-status");
  if (contentType) headers.set("Content-Type", contentType); if (contentLength) headers.set("Content-Length", contentLength); if (etag) headers.set("ETag", etag); if (lastModified) headers.set("Last-Modified", lastModified);
  const cachePolicy = `public, max-age=${ONE_YEAR_SECONDS}, s-maxage=${ONE_YEAR_SECONDS}, immutable`; headers.set("Cache-Control", cachePolicy); headers.set("CDN-Cache-Control", cachePolicy); headers.set("Cloudflare-CDN-Cache-Control", cachePolicy); headers.set("X-Oronno-Media-Cache", cacheState); headers.set("X-Oronno-Media-Variant", variant.id);
  if (supabaseCacheStatus) headers.set("X-Oronno-Supabase-Cache", supabaseCacheStatus); if (cfResized) { headers.set("X-Oronno-Media-Optimized", "true"); headers.set("X-Oronno-Cf-Resized", cfResized); }
  return new Response(body, { status: snapshot.status, statusText: snapshot.statusText, headers });
}

export const Route = createFileRoute("/media")({
  server: { handlers: { GET: async ({ request }) => {
    const directAsset = getDirectAsset(request); const source = directAsset ? null : getSafeSource(request); if (!directAsset && !source) return noStoreResponse("Invalid media source", 400);
    const asset = directAsset ?? (source ? getStorageAsset(source) : null); if (!asset) return noStoreResponse("Invalid storage asset", 400);
    const publicAsset = PUBLIC_MEDIA_BUCKETS.has(asset.bucket); const variant = getVariant(request);
    if (!publicAsset) return noStoreResponse("Media bucket not allowed", 403);
    const cache = getCloudflareCache(); const cacheKey = makeCacheKey(request, asset, variant); const ifNoneMatch = request.headers.get("If-None-Match");
    if (cache) { const hit = await cache.match(cacheKey); if (hit) { const hitEtag = hit.headers.get("ETag"); if (ifNoneMatch && hitEtag && ifNoneMatch.includes(hitEtag)) { const headers = new Headers(hit.headers); headers.delete("Content-Length"); headers.set("X-Oronno-Media-Cache", "HIT-304"); return new Response(null, { status: 304, headers }); } const headers = new Headers(hit.headers); headers.set("X-Oronno-Media-Cache", "HIT"); return new Response(hit.body, { status: hit.status, statusText: hit.statusText, headers }); } }
    const r2Variant = await pullR2Variant(asset, variant); const r2Origin = r2Variant ? null : await pullR2(asset);
    let origin: OriginSnapshot;
    if (r2Variant) {
      origin = r2Variant;
    } else if (r2Origin) {
      origin = r2Origin;
    } else {
      return noStoreResponse("R2 object not found", 404);
    }
    if (!origin.ok) return noStoreResponse(origin.body.slice(0), origin.status, origin.statusText, origin.headers);
    const response = cacheableResponse(origin, origin.body.slice(0), "MISS", variant);
    if (cache) { try { await cache.put(cacheKey, cacheableResponse(origin, origin.body.slice(0), "HIT", variant)); } catch {} }
    return response;
  } },
}});
