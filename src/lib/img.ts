// Supabase Storage → same-domain Cloudflare cache proxy.
// Keep original database URLs/uploads unchanged. Public pages request one
// canonical asset per image through /media, avoiding Supabase transform/srcset
// variants that can multiply Cached Egress.

const SUPABASE_STORAGE_HOSTS = new Set(["bvuhvzccziuniujeogng.supabase.co", "frtzlibogmethppqmhtr.supabase.co"]);

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

function getStorageAssetPath(source: string): string | null {\n  try {\n    const parsed = new URL(source);\n    const match = parsed.pathname.match(/^\\/storage\\/v1\\/object\\/(?:public|sign)\\/([^/]+)\\/(.+)$/);\n    return SUPABASE_STORAGE_HOSTS.has(parsed.hostname) && match ? match[1] + "/" + match[2] : null;\n  } catch { return null; }\n}\n\nfunction throughMediaCache(url: string): string {
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

// Normal loads stay on the fast cached /media path. After a real image error,
// retry once through /media, then fall back to the original Storage object.
export function imgFallback(e: { currentTarget: HTMLImageElement }, original: string | null | undefined) {
  const el = e.currentTarget;
  if (!original) return;
  const attempt = Number(el.dataset["imgRetry"] || "0");
  if (attempt >= 2) return;
  el.dataset["imgRetry"] = String(attempt + 1);
  el.removeAttribute("srcset");
  const source = unwrapMediaCache(original);
  const cached = throughMediaCache(source);
  // Restored rows may already contain /media?src=... URLs. If the proxy path
  // itself fails, the second retry must use the underlying signed/public
  // Supabase URL rather than retrying the exact same /media URL again.
  const retryUrl = attempt === 0 ? cached : source;
  window.setTimeout(() => {
    if (el.dataset["imgLoaded"] === "1") return;
    el.src = retryUrl;
  }, attempt === 0 ? 80 : 250);
}

export function markImgLoaded(e: { currentTarget: HTMLImageElement }) {
  e.currentTarget.dataset["imgLoaded"] = "1";
}
