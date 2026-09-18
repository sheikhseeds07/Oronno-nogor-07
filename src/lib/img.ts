// Supabase Storage → same-domain Cloudflare cache proxy.
// Keep original database URLs/uploads unchanged. Public pages request one
// canonical asset per image through /media, avoiding Supabase transform/srcset
// variants that can multiply Cached Egress.

const SUPABASE_STORAGE_HOST = "bvuhvzccziuniujeogng.supabase.co";

function throughMediaCache(url: string): string {
  try {
    const parsed = new URL(url);
    if (
      parsed.protocol === "https:" &&
      parsed.hostname === SUPABASE_STORAGE_HOST &&
      parsed.pathname.startsWith("/storage/v1/")
    ) {
      return `/media?src=${encodeURIComponent(url)}`;
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
  const cached = throughMediaCache(original);
  const retryUrl = attempt === 0 ? cached : original;
  window.setTimeout(() => {
    if (el.dataset["imgLoaded"] === "1") return;
    el.src = retryUrl;
  }, attempt === 0 ? 80 : 250);
}

export function markImgLoaded(e: { currentTarget: HTMLImageElement }) {
  e.currentTarget.dataset["imgLoaded"] = "1";
}
