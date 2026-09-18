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
  } catch {
    // Relative/non-standard URLs keep their previous behavior.
  }
  return url;
}

export function toImg(
  url: string | null | undefined,
  _opts: { w?: number; h?: number; q?: number } = {},
): string {
  if (!url) return "";
  if (url.startsWith("data:") || url.startsWith("blob:")) return url;

  // Do not call Supabase /render/image for public page views. The original
  // object is cached once by Cloudflare and CSS/browser sizing handles display.
  return throughMediaCache(url);
}

// Use a single canonical candidate instead of requesting several transformed
// widths from Supabase. This preserves responsive <img> markup without creating
// multiple origin/cache variants for the same stored file.
export function imgSrcSet(
  url: string | null | undefined,
  widths: number[],
  _q = 75,
): string {
  if (!url || widths.length === 0) return "";
  const largest = Math.max(...widths);
  return `${toImg(url)} ${largest}w`;
}

// Retry through the same Cloudflare proxy. Original Supabase URLs stay in the
// database and remain the origin of truth; no storage object is moved/deleted.
export function imgFallback(
  e: { currentTarget: HTMLImageElement },
  original: string | null | undefined,
) {
  const el = e.currentTarget;
  if (!original) return;

  // A transient CDN/origin miss should not leave a broken image on the first view.
  // Retry the same canonical asset with a bounded cache-busting query; this keeps
  // normal loads fast and avoids generating multiple Supabase transform variants.
  const attempt = Number(el.dataset["imgRetry"] || "0");
  if (attempt >= 2) return;
  el.dataset["imgRetry"] = String(attempt + 1);
  el.removeAttribute("srcset");

  const cached = throughMediaCache(original);
  const retryUrl = cached.includes("?")
    ? `${cached}&img_retry=${attempt + 1}`
    : `${cached}?img_retry=${attempt + 1}`;

  window.setTimeout(() => {
    if (el.dataset["imgLoaded"] === "1") return;
    el.src = retryUrl;
  }, attempt === 0 ? 80 : 350);
}
