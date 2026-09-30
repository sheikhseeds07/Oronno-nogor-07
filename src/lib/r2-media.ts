export const PUBLIC_MEDIA_BUCKETS = new Set([
  "product-images", "category-images", "banners", "site-assets", "landing-images",
  "review-images", "customer-profiles", "community-media", "blog-images", "public-assets",
]);
const LEGACY_STORAGE_HOSTS = new Set([
  "bvuhvzccziuniujeogng.supabase.co", "frtzlibogmethppqmhtr.supabase.co",
  "yqhtenonavuzxzemaiyk.supabase.co",
]);

export function safeMediaKey(key: string): string | null {
  const slash = key.indexOf("/");
  if (slash < 1 || key.length > 1000 || !PUBLIC_MEDIA_BUCKETS.has(key.slice(0, slash))) return null;
  const path = key.slice(slash + 1);
  if (!path || /[\\\x00-\x1f\x7f]/.test(path) || /%(?:2e|2f|5c|00)/i.test(path)) return null;
  if (path.split("/").some(segment => !segment || segment === "." || segment === "..")) return null;
  return key;
}

// Parse old database metadata locally, retaining only the corresponding R2 key.
// No request, signed URL creation, or token forwarding takes place here.
export function legacyMediaKey(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || !LEGACY_STORAGE_HOSTS.has(url.hostname)) return null;
    const match = url.pathname.match(/^\/storage\/v1\/(?:object|render\/image)\/(?:public|sign|authenticated)\/([^/]+)\/(.+)$/);
    if (!match) return null;
    return safeMediaKey(`${decodeURIComponent(match[1])}/${decodeURIComponent(match[2])}`);
  } catch { return null; }
}

export function legacyMediaBucket(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || !LEGACY_STORAGE_HOSTS.has(url.hostname)) return null;
    const match = url.pathname.match(/^\/storage\/v1\/(?:object|render\/image)\/(?:public|sign|authenticated)\/([^/]+)\//);
    return match ? decodeURIComponent(match[1]) : null;
  } catch { return null; }
}

export function r2MediaUrl(key: string, endpoint: string): string | null {
  const safe = safeMediaKey(key);
  if (!safe) return null;
  return endpoint === "/media"
    ? `/media?asset=${encodeURIComponent(safe)}`
    : `${endpoint}/${safe.split("/").map(encodeURIComponent).join("/")}`;
}
