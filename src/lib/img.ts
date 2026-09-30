// Supabase Storage → same-domain Cloudflare cache proxy.
// Keep original database URLs/uploads unchanged. Public pages request one
// canonical asset per image through /media, avoiding Supabase transform/srcset
// variants that can multiply Cached Egress.

const SUPABASE_STORAGE_HOSTS = new Set(["bvuhvzccziuniujeogng.supabase.co", "frtzlibogmethppqmhtr.supabase.co", "yqhtenonavuzxzemaiyk.supabase.co"]);

function unwrapMediaCache(url: string): string {
  try {
    const parsed = new URL(url, "https://sheikhseeds.com");
    if (parsed.pathname === "/media") {
      const src = parsed.searchParams.get("src");
      if (src) return src;
    }
  } catch {}
  return url;
}

function getStorageAssetPath(source: string): string | null {
  try {
    const parsed = new URL(source);
    const match = parsed.pathname.match(/^\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/(.+)$/);
    return SUPABASE_STORAGE_HOSTS.has(parsed.hostname) && match ? match[1] + "/" + match[2] : null;
  } catch { return null; }
}

function throughMediaCache(url: string): string {
  const source = unwrapMediaCache(url);
  try {
    const parsed = new URL(source);
    if (
      parsed.protocol === "https:" &&
      SUPABASE_STORAGE_HOSTS.has(parsed.hostname) &&
      parsed.pathname.startsWith("/storage/v1/")
    ) {
      const asset = getStorageAssetPath(source); return asset ? `/media?asset=${encodeURIComponent(asset)}` : url;
    }
  } catch {}
  return url;
}

export function toImg(url: string | null | undefined, _opts: { w?: number; h?: number; q?: number } = {}): string {
  if (!url) return "";
  if (url.startsWith("data:") || url.startsWith("blob:")) return url;
  return throughMediaCache(url);
}

export function imgSrcSet(url: string | null | undefined, widths: number[], _q = 75): string {
  if (!url || widths.length === 0) return "";
  const largest = Math.max(...widths);
  return `${toImg(url)} ${largest}w`;
}

// Never retry an origin or a failed R2 URL. Inline placeholder requires no network.
export function imgFallback(e: { currentTarget: HTMLImageElement }, _original: string | null | undefined) {
  const el = e.currentTarget;
  if (el.dataset["imgFailed"] === "1") return;
  el.dataset["imgFailed"] = "1";
  el.removeAttribute("srcset");
  el.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400'%3E%3Crect width='400' height='400' fill='%23f1f5f9'/%3E%3C/svg%3E";
}

export function markImgLoaded(e: { currentTarget: HTMLImageElement }) {
  e.currentTarget.dataset["imgLoaded"] = "1";
}
