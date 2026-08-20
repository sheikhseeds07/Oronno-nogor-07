// Supabase Storage image optimization + same-domain Cloudflare cache proxy.
// The database keeps the original Supabase URLs and uploads stay unchanged.
// Public page views use /media so repeat image traffic is served from Cloudflare
// instead of repeatedly consuming Supabase Cached Egress.

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
    // Relative/non-standard URLs should keep their previous behavior.
  }
  return url;
}

export function toImg(
  url: string | null | undefined,
  opts: { w?: number; h?: number; q?: number } = {},
): string {
  if (!url) return "";
  if (url.startsWith("data:") || url.startsWith("blob:")) return url;

  // Match Supabase storage object URL → render/image equivalent.
  // Keep the access kind (public / sign / authenticated) and the existing
  // token, then send the optimized result through our Cloudflare cache route.
  const m = url.match(/^(https?:\/\/[^/]+\/storage\/v1)\/object\/(public|sign|authenticated)\/([^?]+)(\?.*)?$/);
  if (!m) return throughMediaCache(url);

  const base = m[1];
  const kind = m[2];
  const rest = m[3];
  const params = new URLSearchParams(m[4] ? m[4].slice(1) : "");
  if (opts.w) params.set("width", String(opts.w));
  if (opts.h) params.set("height", String(opts.h));
  params.set("quality", String(opts.q ?? 75));
  params.set("format", "webp");
  params.set("resize", "cover");

  return throughMediaCache(`${base}/render/image/${kind}/${rest}?${params.toString()}`);
}

// Build a srcset for responsive product images.
export function imgSrcSet(url: string | null | undefined, widths: number[], q = 75): string {
  if (!url) return "";
  return widths
    .map((w) => `${toImg(url, { w, q })} ${w}w`)
    .join(", ");
}

// If the transform endpoint cannot serve an image, retry the original object
// through the same Cloudflare cache proxy. We never fall back to direct public
// Supabase delivery unless the URL is not from this project's Storage host.
export function imgFallback(
  e: { currentTarget: HTMLImageElement },
  original: string | null | undefined,
) {
  const el = e.currentTarget;
  if (!original || el.dataset["fallback"] === "1") return;
  el.dataset["fallback"] = "1";
  el.removeAttribute("srcset");
  el.src = throughMediaCache(original);
}
